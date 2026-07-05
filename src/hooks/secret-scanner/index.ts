import type { Hooks } from "@opencode-ai/plugin"
import type { SecretScannerConfig } from "../../features/security-guards/config-schema"

import picomatch from "picomatch"
import { findKnownSecrets, findHighEntropyStrings } from "./patterns"
import { evaluateSeverity } from "./severity"
import { log } from "../../shared"

type Deps = {
  config: SecretScannerConfig
}

function getFilePath(args: Record<string, unknown>): string | undefined {
  const raw = args["filePath"] ?? args["path"] ?? args["file_path"]
  return typeof raw === "string" ? raw : undefined
}

function getContent(args: Record<string, unknown>): string | undefined {
  const raw = args["content"]
  if (typeof raw === "string") return raw
  const newString = args["newString"] ?? args["new_string"]
  if (typeof newString === "string") return newString
  return undefined
}

function isAllowlisted(
  filePath: string,
  allowlistPatterns: string[],
  allowlistPaths: string[],
): boolean {
  for (const pattern of allowlistPatterns) {
    if (picomatch(pattern, { dot: true })(filePath)) return true
  }
  for (const pattern of allowlistPaths) {
    if (picomatch(pattern, { dot: true })(filePath)) return true
  }
  return false
}

function extractStagedDiffContent(command: string): string | null {
  if (!/\bgit\s+commit\b/.test(command)) return null
  if (!/\bdiff\b.*--cached/.test(command) && !/\bstaged/.test(command)) return null
  return null
}

export function createSecretScannerHook(deps: Deps): Hooks {
  const { config } = deps

  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      if (!config.enabled) return

      const toolLower = input.tool.toLowerCase()
      if (toolLower !== "write" && toolLower !== "edit" && toolLower !== "apply_patch") return

      const filePath = getFilePath(output.args)
      if (filePath && isAllowlisted(filePath, config.allowlist_patterns, config.allowlist_paths)) {
        return
      }

      const content = getContent(output.args)
      if (!content) return

      const knownMatches = findKnownSecrets(content)
      const highEntropyMatches = findHighEntropyStrings(content)

      if (knownMatches.length === 0 && highEntropyMatches.length === 0) return

      const severity = evaluateSeverity(knownMatches, highEntropyMatches, config.severity)

      log("[secret-scanner] secrets detected in write content", {
        sessionID: input.sessionID,
        filePath,
        knownCount: knownMatches.length,
        entropyCount: highEntropyMatches.length,
        shouldBlock: severity.shouldBlock,
        shouldWarn: severity.shouldWarn,
      })

      if (severity.shouldBlock) {
        throw new Error(severity.message)
      }

      if (severity.shouldWarn) {
        log("[secret-scanner] warning (not blocking)", {
          sessionID: input.sessionID,
          message: severity.message,
        })
      }
    },
  }
}
