import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { OhMyOpenCodeConfigSchema } from "../../config/schema"
import { parseJsonc } from "../../shared"
import { backupConfigFile } from "../config-manager/backup-config"

type ConfigExportOptions = {
  readonly output?: string
  readonly format?: "json" | "jsonc"
}

type ConfigImportOptions = {
  readonly merge?: boolean
}

const SENSITIVE_FIELDS = [
  "api_key",
  "apiKey",
  "token",
  "secret",
  "password",
  "authorization",
  "anthropic_api_key",
  "openai_api_key",
  "google_api_key",
  "github_token",
  "license_key",
  "access_token",
  "refresh_token",
]

function containsSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_FIELDS.some((field) => lower.includes(field.toLowerCase()))
}

function isLikelyCredentialValue(value: string): boolean {
  // Match hex strings (API keys, tokens), base64-like strings, or prefixed secrets
  return /^(sk-|ghp_|gho_|xoxb-|xoxp-|Bearer\s+|eyJ)/i.test(value)
    || /^[A-Za-z0-9+/=_-]{20,}$/.test(value)
    || /^[0-9a-f]{20,}$/i.test(value)
}

export function redactSensitiveFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === "string") {
    // Only redact strings that look like actual credentials (long opaque values),
    // not strings that merely contain a sensitive keyword (e.g. descriptions, URLs).
    if (isLikelyCredentialValue(obj)) {
      return "[REDACTED]"
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveFields(item))
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (containsSensitiveKey(key)) {
        result[key] = "[REDACTED]"
      } else {
        result[key] = redactSensitiveFields(value)
      }
    }
    return result
  }

  return obj
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }

  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] !== null &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      )
    } else {
      result[key] = value
    }
  }

  return result
}

function resolveConfigDir(): string {
  // XDG_CONFIG_HOME takes precedence when set (for testing and custom setups)
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, "opencode")
  }

  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode")
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "opencode")
  }

  return join(homedir(), ".config", "opencode")
}

function resolveConfigPath(): string {
  return join(resolveConfigDir(), "oh-my-agent.json")
}

function readConfigFile(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null

  try {
    const content = readFileSync(path, "utf-8")
    const parsed = parseJsonc<unknown>(content)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

function formatOutput(config: Record<string, unknown>, format: "json" | "jsonc"): string {
  if (format === "jsonc") {
    return JSON.stringify(config, null, 2) + "\n"
  }
  return JSON.stringify(config, null, 2) + "\n"
}

export async function configExportCommand(options: ConfigExportOptions): Promise<void> {
  const configPath = resolveConfigPath()
  const config = readConfigFile(configPath)

  if (!config) {
    console.log("No config found at", configPath)
    console.log("Nothing to export.")
    return
  }

  const redacted = redactSensitiveFields(config) as Record<string, unknown>

  const format = options.format ?? "json"
  const output = formatOutput(redacted, format)

  if (options.output) {
    const dir = dirname(options.output)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(options.output, output, "utf-8")
    console.log(`Config exported to ${options.output}`)
  } else {
    process.stdout.write(output)
  }
}

export async function configImportCommand(
  file: string,
  options: ConfigImportOptions,
): Promise<void> {
  if (!existsSync(file)) {
    console.error(`Error: file not found: ${file}`)
    process.exit(1)
  }

  const rawContent = readFileSync(file, "utf-8")
  let importedConfig: Record<string, unknown>

  try {
    const parsed = parseJsonc<unknown>(rawContent)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.error("Error: config file must contain a JSON object")
      process.exit(1)
    }
    importedConfig = parsed as Record<string, unknown>
  } catch (err) {
    console.error(`Error: failed to parse config file: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  const result = OhMyOpenCodeConfigSchema.safeParse(importedConfig)
  if (!result.success) {
    console.error("Error: config validation failed:")
    for (const issue of result.error.issues) {
      const path = issue.path.map((p) => String(p)).join(".")
      console.error(`  ${path || "<root>"}: ${issue.message}`)
    }
    process.exit(1)
  }

  const configPath = resolveConfigPath()

  if (existsSync(configPath)) {
    const backupResult = backupConfigFile(configPath)
    if (backupResult.success && backupResult.backupPath) {
      console.log(`Backup created: ${backupResult.backupPath}`)
    } else if (!backupResult.success) {
      console.error(`Warning: failed to create backup: ${backupResult.error}`)
    }
  }

  const dir = dirname(configPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  if (options.merge && existsSync(configPath)) {
    const existing = readConfigFile(configPath)
    if (existing) {
      // source (imported) wins over target (existing)
      const merged = deepMerge(existing, importedConfig)
      writeFileSync(configPath, JSON.stringify(merged, null, 2) + "\n", "utf-8")
      console.log(`Config merged and written to ${configPath}`)
      return
    }
  }

  writeFileSync(configPath, JSON.stringify(importedConfig, null, 2) + "\n", "utf-8")
  console.log(`Config written to ${configPath}`)
}
