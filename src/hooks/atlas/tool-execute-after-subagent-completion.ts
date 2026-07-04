import type { PluginInput } from "@opencode-ai/plugin"
import { collectGitDiffStats, formatFileChanges } from "../../shared/git-worktree"
import { log } from "../../shared/logger"
import { HOOK_NAME } from "./hook-name"
import { extractSessionIdFromOutput, validateSubagentSessionId } from "./subagent-session-id"
import type { PendingTaskRef, SessionState, ToolExecuteAfterInput, ToolExecuteAfterOutput } from "./types"
import { buildStandaloneVerificationReminder } from "./verification-reminders"

function isBackgroundLaunchOutput(output: string): boolean {
  return output.includes("Background task launched") || output.includes("Background task continued")
    || output.includes("Background delegate launched")
    || output.includes("Background agent task launched")
}

function isBackgroundOutputIncompleteReport(toolName: string, output: string): boolean {
  if (toolName !== "background_output") return false
  const trimmedOutput = output.trimStart()
  const incompleteStatus = "(?:pending|running|error|cancelled|interrupt)"
  const taskStatusTable = new RegExp(
    `^# Task Status\\b[\\s\\S]*\\|\\s*Status\\s*\\|\\s*\\*\\*${incompleteStatus}\\*\\*\\s*\\|`,
  )
  const fullSessionStatusReport = new RegExp(`^# Full Session Output\\b[\\s\\S]*^Status:\\s*${incompleteStatus}\\s*$`, "m")
  const bareStatusReport = new RegExp(`^Status:\\s*${incompleteStatus}\\s*$`)

  return taskStatusTable.test(trimmedOutput)
    || fullSessionStatusReport.test(trimmedOutput)
    || bareStatusReport.test(trimmedOutput)
    || trimmedOutput.startsWith("Error fetching messages:")
}

export async function handleSubagentCompletionAfter(input: {
  ctx: PluginInput
  pendingTaskRefs: Map<string, PendingTaskRef>
  autoCommit: boolean
  getState: (sessionID: string) => SessionState
  collectGitDiffStats: typeof collectGitDiffStats
  formatFileChanges: typeof formatFileChanges
  toolInput: ToolExecuteAfterInput
  toolOutput: ToolExecuteAfterOutput
  metadataSessionId: string | undefined
}): Promise<void> {
  const {
    ctx,
    pendingTaskRefs,
    autoCommit,
    getState,
    collectGitDiffStats: collectGitDiffStatsImpl,
    formatFileChanges: formatFileChangesImpl,
    toolInput,
    toolOutput,
    metadataSessionId,
  } = input
  const outputStr = typeof toolOutput.output === "string" ? toolOutput.output : ""
  const pendingTaskRef = toolInput.callID ? pendingTaskRefs.get(toolInput.callID) : undefined
  if (toolInput.callID) {
    pendingTaskRefs.delete(toolInput.callID)
  }

  if (isBackgroundLaunchOutput(outputStr)) {
    return
  }

  if (outputStr.length === 0) {
    return
  }
  if (isBackgroundOutputIncompleteReport(toolInput.tool, outputStr)) {
    return
  }

  const gitStats = collectGitDiffStatsImpl(ctx.directory)
  const fileChanges = formatFileChangesImpl(gitStats)
  const extractedSessionId = metadataSessionId ?? extractSessionIdFromOutput(outputStr)

  const lineageSessionIDs = toolInput.sessionID ? [toolInput.sessionID] : []
  const subagentSessionId = await validateSubagentSessionId({
    client: ctx.client,
    sessionID: extractedSessionId,
    lineageSessionIDs,
  })

  const originalResponse = toolOutput.output
  toolOutput.output = `
<system-reminder>
${buildStandaloneVerificationReminder(subagentSessionId ?? "<session_id>")}
</system-reminder>

## SUBAGENT WORK COMPLETED

${fileChanges}

---

**Subagent Response:**

${originalResponse}`

  log(`[${HOOK_NAME}] Output transformed for orchestrator mode`, {
    fileCount: gitStats.length,
    subagentSessionId,
  })
}
