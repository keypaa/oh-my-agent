import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

function makeTmpDir(): string {
  const dir = join(tmpdir(), `omo-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe("config export/import", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe("redactSensitiveFields", () => {
    it("redacts fields containing sensitive keywords", async () => {
      const { redactSensitiveFields } = await import("./config")
      const input = {
        api_key: "sk-12345",
        token: "abc-def",
        safe_field: "keep-this",
        nested: { secret_token: "nested-secret", other: "value" },
        arr: [{ password: "pass123" }, "safe"],
      }

      const result = redactSensitiveFields(input) as Record<string, unknown>

      expect(result.api_key).toBe("[REDACTED]")
      expect(result.token).toBe("[REDACTED]")
      expect(result.safe_field).toBe("keep-this")
      expect((result.nested as Record<string, unknown>).secret_token).toBe("[REDACTED]")
      expect((result.nested as Record<string, unknown>).other).toBe("value")
      expect((result.arr as Array<unknown>)[0]).toEqual({ password: "[REDACTED]" })
      expect((result.arr as Array<unknown>)[1]).toBe("safe")
    })

    it("preserves non-object values unchanged", async () => {
      const { redactSensitiveFields } = await import("./config")

      expect(redactSensitiveFields(null)).toBeNull()
      expect(redactSensitiveFields(undefined)).toBeUndefined()
      expect(redactSensitiveFields(42)).toBe(42)
      expect(redactSensitiveFields("hello")).toBe("hello")
    })

    it("does not redact strings that merely contain sensitive keywords", async () => {
      const { redactSensitiveFields } = await import("./config")

      expect(redactSensitiveFields("Enter your api_key below")).toBe("Enter your api_key below")
      expect(redactSensitiveFields("https://example.com/token/endpoint")).toBe("https://example.com/token/endpoint")
      expect(redactSensitiveFields("Set the password policy")).toBe("Set the password policy")
    })

    it("redacts actual credential values (prefixed secrets, long hex/base64)", async () => {
      const { redactSensitiveFields } = await import("./config")

      expect(redactSensitiveFields("sk-abc123def456")).toBe("[REDACTED]")
      expect(redactSensitiveFields("ghp_abcdefghijklmnopqrstuvwxyz")).toBe("[REDACTED]")
      expect(redactSensitiveFields("eyJhbGciOiJIUzI1NiJ9")).toBe("[REDACTED]")
      expect(redactSensitiveFields("a".repeat(40))).toBe("[REDACTED]")
      expect(redactSensitiveFields("abcdef1234567890abcdef1234567890")).toBe("[REDACTED]")
    })
  })

  describe("configExportCommand", () => {
    it("exports redacted config to stdout", async () => {
      const configDir = join(tmpDir, "opencode")
      mkdirSync(configDir, { recursive: true })
      const configPath = join(configDir, "oh-my-agent.json")

      writeFileSync(configPath, JSON.stringify({
        cost_tracker: { enabled: true },
        api_key: "sk-secret-123",
        team_mode: { enabled: false },
      }, null, 2))

      const originalEnv = { ...process.env }
      process.env.XDG_CONFIG_HOME = tmpDir

      try {
        const stdout = await captureStdout(async () => {
          const { configExportCommand } = await import("./config")
          await configExportCommand({})
        })

        const parsed = JSON.parse(stdout)
        expect(parsed.cost_tracker).toEqual({ enabled: true })
        expect(parsed.api_key).toBe("[REDACTED]")
        expect(parsed.team_mode).toEqual({ enabled: false })
      } finally {
        process.env = originalEnv
      }
    })

    it("exports to file when --output is specified", async () => {
      const configDir = join(tmpDir, "opencode")
      mkdirSync(configDir, { recursive: true })
      const configPath = join(configDir, "oh-my-agent.json")
      const outputPath = join(tmpDir, "exported.json")

      writeFileSync(configPath, JSON.stringify({
        cost_tracker: { enabled: true },
        token: "secret-value",
      }, null, 2))

      const originalEnv = { ...process.env }
      process.env.XDG_CONFIG_HOME = tmpDir

      try {
        const { configExportCommand } = await import("./config")
        await configExportCommand({ output: outputPath })

        expect(existsSync(outputPath)).toBe(true)
        const content = readFileSync(outputPath, "utf-8")
        const parsed = JSON.parse(content)
        expect(parsed.token).toBe("[REDACTED]")
      } finally {
        process.env = originalEnv
      }
    })

    it("handles missing config gracefully", async () => {
      const originalEnv = { ...process.env }
      process.env.XDG_CONFIG_HOME = join(tmpDir, "nonexistent")

      try {
        const logs: string[] = []
        const origLog = console.log
        console.log = (...args: unknown[]) => logs.push(args.join(" "))

        try {
          const { configExportCommand } = await import("./config")
          await configExportCommand({})
        } finally {
          console.log = origLog
        }

        expect(logs.some((l) => l.includes("No config found"))).toBe(true)
      } finally {
        process.env = originalEnv
      }
    })
  })

  describe("configImportCommand", () => {
    it("imports valid config (replace mode)", async () => {
      const configDir = join(tmpDir, "opencode")
      mkdirSync(configDir, { recursive: true })

      const importFile = join(tmpDir, "import.json")
      writeFileSync(importFile, JSON.stringify({
        cost_tracker: { enabled: false, max_file_size_mb: 20 },
        team_mode: { enabled: true, max_parallel_members: 4 },
      }, null, 2))

      const originalEnv = { ...process.env }
      process.env.XDG_CONFIG_HOME = tmpDir

      try {
        const { configImportCommand } = await import("./config")
        await configImportCommand(importFile, { merge: false })

        const configPath = join(configDir, "oh-my-agent.json")
        expect(existsSync(configPath)).toBe(true)

        const content = readFileSync(configPath, "utf-8")
        const parsed = JSON.parse(content)
        expect(parsed.cost_tracker).toEqual({ enabled: false, max_file_size_mb: 20 })
        expect(parsed.team_mode).toEqual({ enabled: true, max_parallel_members: 4 })
      } finally {
        process.env = originalEnv
      }
    })

    it("merges with existing config when --merge is set", async () => {
      const configDir = join(tmpDir, "opencode")
      mkdirSync(configDir, { recursive: true })
      const configPath = join(configDir, "oh-my-agent.json")

      writeFileSync(configPath, JSON.stringify({
        cost_tracker: { enabled: true, max_file_size_mb: 10 },
        team_mode: { enabled: false },
      }, null, 2))

      const importFile = join(tmpDir, "import.json")
      writeFileSync(importFile, JSON.stringify({
        cost_tracker: { enabled: false },
      }, null, 2))

      const originalEnv = { ...process.env }
      process.env.XDG_CONFIG_HOME = tmpDir

      try {
        const { configImportCommand } = await import("./config")
        await configImportCommand(importFile, { merge: true })

        const content = readFileSync(configPath, "utf-8")
        const parsed = JSON.parse(content)

        // cost_tracker: imported value wins, but existing extra keys preserved
        expect(parsed.cost_tracker).toEqual({ enabled: false, max_file_size_mb: 10 })
        // team_mode: preserved from original (not in import)
        expect(parsed.team_mode).toEqual({ enabled: false })
      } finally {
        process.env = originalEnv
      }
    })

    it("creates backup before overwriting", async () => {
      const configDir = join(tmpDir, "opencode")
      mkdirSync(configDir, { recursive: true })
      const configPath = join(configDir, "oh-my-agent.json")

      writeFileSync(configPath, JSON.stringify({
        cost_tracker: { enabled: true },
      }, null, 2))

      const importFile = join(tmpDir, "import.json")
      writeFileSync(importFile, JSON.stringify({
        cost_tracker: { enabled: false },
      }, null, 2))

      const originalEnv = { ...process.env }
      process.env.XDG_CONFIG_HOME = tmpDir

      try {
        const { configImportCommand } = await import("./config")
        await configImportCommand(importFile, { merge: false })

        const { readdirSync } = await import("node:fs")
        const files = readdirSync(configDir)
        const backupFile = files.find((f) => f.startsWith("oh-my-agent.json.backup-"))
        expect(backupFile).toBeDefined()
      } finally {
        process.env = originalEnv
      }
    })

    it("rejects invalid config", async () => {
      const importFile = join(tmpDir, "bad.json")
      writeFileSync(importFile, JSON.stringify({
        team_mode: { enabled: "not-a-boolean" },
      }, null, 2))

      let exitCode = 0
      const originalExit = process.exit
      process.exit = ((code: number) => { exitCode = code; throw new Error("exit") }) as typeof process.exit

      try {
        const { configImportCommand } = await import("./config")
        await configImportCommand(importFile, { merge: false })
      } catch {
        // expected
      } finally {
        process.exit = originalExit
      }

      expect(exitCode).toBe(1)
    })

    it("rejects non-existent file", async () => {
      let exitCode = 0
      const originalExit = process.exit
      process.exit = ((code: number) => { exitCode = code; throw new Error("exit") }) as typeof process.exit

      try {
        const { configImportCommand } = await import("./config")
        await configImportCommand("/nonexistent/file.json", { merge: false })
      } catch {
        // expected
      } finally {
        process.exit = originalExit
      }

      expect(exitCode).toBe(1)
    })
  })
})

async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const originalWrite = process.stdout.write
  let output = ""
  process.stdout.write = ((chunk: string | Buffer) => {
    output += typeof chunk === "string" ? chunk : chunk.toString()
    return true
  }) as typeof process.stdout.write

  try {
    await fn()
  } finally {
    process.stdout.write = originalWrite
  }

  return output
}
