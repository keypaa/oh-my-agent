import type { PluginInput } from "@opencode-ai/plugin"
import { extractTaskLink } from "../../features/tool-metadata-store"
import { log } from "../../shared/logger"
import { HOOK_NAME } from "./hook-name"

export function extractSessionIdFromMetadata(metadata: unknown): string | undefined {
  const sessionId = extractTaskLink(metadata, "").sessionId
  if (typeof sessionId === "string" && sessionId.startsWith("ses_")) {
    return sessionId
  }

  return undefined
}

export function extractSessionIdFromOutput(output: string): string | undefined {
  return extractTaskLink(undefined, output).sessionId
}

export async function validateSubagentSessionId(input: {
  client: PluginInput["client"]
  sessionID?: string
  lineageSessionIDs: string[]
}): Promise<string | undefined> {
  if (!input.sessionID || input.lineageSessionIDs.length === 0) {
    return undefined
  }

  return input.sessionID
}
