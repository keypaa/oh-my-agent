import type { PluginInput } from "@opencode-ai/plugin"
import type { HaruspexGuardConfig } from "../../config/schema/haruspex-guard"
import { resolvePathVerdict } from "./scope-table"
import { logDiff } from "./diff-display"
import { log } from "../../shared"
import { getAgentFromSession } from "../prometheus-md-only/agent-resolution"

const HARUSPEX_AGENT = "haruspex"

const WRITE_TOOLS = new Set(["write", "edit", "apply_patch"])

function isHaruspexAgent(agentName: string | undefined): boolean {
  return agentName?.toLowerCase().includes(HARUSPEX_AGENT) ?? false
}

function getFilePath(args: Record<string, unknown>): string | undefined {
  const raw = args["filePath"] ?? args["path"] ?? args["file_path"]
  return typeof raw === "string" ? raw : undefined
}

export function createHaruspexGuardHook(
  ctx: PluginInput,
  config: HaruspexGuardConfig,
): {
  "tool.execute.before": (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: Record<string, unknown> },
  ) => Promise<void>
} {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      if (!config.enabled) return
      if (!WRITE_TOOLS.has(input.tool)) return

      const agentName = await getAgentFromSession(input.sessionID, ctx.directory, ctx.client)
      if (!isHaruspexAgent(agentName)) return

      const filePath = getFilePath(output.args)
      if (!filePath) return

      const verdict = resolvePathVerdict(filePath, config)

      if (verdict === "denied") {
        log("[haruspex-guard] Blocked write to denied path", {
          sessionID: input.sessionID,
          filePath,
          agent: agentName,
        })
        throw new Error(
          `[haruspex-guard] Haruspex is not allowed to modify ${filePath}. ` +
          `This path is outside Haruspex's maintenance scope. ` +
          `Denied paths: ${config.denied_paths.join(", ")}`,
        )
      }

      if (verdict === "confirm") {
        log("[haruspex-guard] Warning: Haruspex modifying confirmation-required path", {
          sessionID: input.sessionID,
          filePath,
          agent: agentName,
        })
      }

      if (config.show_diff) {
        const newContent = typeof output.args.content === "string"
          ? output.args.content
          : typeof output.args.newText === "string"
            ? output.args.newText
            : undefined
        logDiff(filePath, undefined, newContent)
      }
    },
  }
}
