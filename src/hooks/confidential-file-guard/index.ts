import type { Hooks } from "@opencode-ai/plugin"
import type { ConfidentialFilesConfig } from "../../features/security-guards/config-schema"

import { matchesGlob, filterBlockedPaths } from "./glob-matcher"
import { matchBashPatterns, extractPathFromBashCommand } from "./bash-command-guard"
import { log } from "../../shared"

type Deps = {
  config: ConfidentialFilesConfig
}

function isBlockedTool(tool: string): boolean {
  const t = tool.toLowerCase()
  return t === "read" || t === "glob" || t === "grep" || t === "bash" || t === "lsp_diagnostics"
}

function getFilePath(args: Record<string, unknown>): string | undefined {
  const raw = args["filePath"] ?? args["path"] ?? args["file_path"]
  return typeof raw === "string" ? raw : undefined
}

function buildBlockMessage(template: string, path: string): string {
  return template.replace("{path}", path)
}

export function createConfidentialFileGuardHook(deps: Deps): Hooks {
  const { config } = deps

  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      if (!config.enabled) return
      if (!isBlockedTool(input.tool)) return

      const toolLower = input.tool.toLowerCase()

      if (toolLower === "read" || toolLower === "lsp_diagnostics") {
        const filePath = getFilePath(output.args)
        if (filePath && matchesGlob(filePath, config.paths)) {
          log("[confidential-file-guard] blocked read of confidential file", {
            sessionID: input.sessionID,
            filePath,
          })
          throw new Error(buildBlockMessage(config.block_message, filePath))
        }
      }

      if (toolLower === "grep") {
        const target = typeof output.args.target === "string" ? output.args.target : undefined
        const path = typeof output.args.path === "string" ? output.args.path : undefined
        if (path && matchesGlob(path, config.paths)) {
          log("[confidential-file-guard] blocked grep on confidential path", {
            sessionID: input.sessionID,
            path,
          })
          throw new Error(buildBlockMessage(config.block_message, path))
        }
        if (target && matchesGlob(target, config.paths)) {
          log("[confidential-file-guard] blocked grep targeting confidential file", {
            sessionID: input.sessionID,
            target,
          })
          throw new Error(buildBlockMessage(config.block_message, target))
        }
      }

      if (toolLower === "bash") {
        const command = typeof output.args.command === "string" ? output.args.command : ""
        if (!command) return

        const matches = matchBashPatterns(command)
        if (matches.length === 0) return

        for (const match of matches) {
          if (match.type === "env-dump") {
            log("[confidential-file-guard] blocked env dump command", {
              sessionID: input.sessionID,
              command,
            })
            throw new Error("Environment variable dumps are blocked by security policy.")
          }
          if (match.type === "source") {
            log("[confidential-file-guard] blocked sourcing .env file", {
              sessionID: input.sessionID,
              command,
            })
            throw new Error("Sourcing .env files is blocked by security policy.")
          }
        }

        const bashPath = extractPathFromBashCommand(command)
        if (bashPath && matchesGlob(bashPath, config.paths)) {
          log("[confidential-file-guard] blocked bash access to confidential file", {
            sessionID: input.sessionID,
            command,
            path: bashPath,
          })
          throw new Error(buildBlockMessage(config.block_message, bashPath))
        }
      }
    },

    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string; args?: Record<string, unknown> },
      output: { title: string; output: string; metadata: unknown },
    ): Promise<void> => {
      if (!config.enabled) return
      if (input.tool.toLowerCase() !== "glob") return

      try {
        const result = JSON.parse(output.output) as { files?: string[] } | string[]
        let files: string[] = []
        if (Array.isArray(result)) {
          files = result
        } else if (result && typeof result === "object" && Array.isArray(result.files)) {
          files = result.files
        }

        const blocked = files.filter((f) => matchesGlob(f, config.paths))
        if (blocked.length === 0) return

        const filtered = filterBlockedPaths(files, config.paths)
        output.output = JSON.stringify(filtered)

        log("[confidential-file-guard] filtered confidential files from glob results", {
          sessionID: input.sessionID,
          blockedCount: blocked.length,
          blocked,
        })
      } catch {
        // JSON parse failure — leave output unchanged
      }
    },
  }
}
