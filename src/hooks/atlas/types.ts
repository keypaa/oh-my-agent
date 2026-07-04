import type { AgentOverrides } from "../../config"

export type ModelInfo = { providerID: string; modelID: string; variant?: string }

export interface BackgroundTaskStatusProvider {
  getTasksByParentSession: (sessionID: string) => Array<{ status: string }>
}

export interface AtlasHookOptions {
  directory: string
  backgroundManager?: BackgroundTaskStatusProvider
  isContinuationStopped?: (sessionID: string) => boolean
  isCallerOrchestrator?: (sessionID: string | undefined) => Promise<boolean>
  agentOverrides?: AgentOverrides
  idleSettleMs?: number
  /** Enable auto-commit after each atomic task completion (default: true) */
  autoCommit?: boolean
}

export interface ToolExecuteAfterInput {
  tool: string
  sessionID?: string
  callID?: string
}

export interface ToolExecuteAfterOutput {
  title: string
  output: string
  metadata: Record<string, unknown>
}

export type TrackedTopLevelTaskRef = { key: string; label: string; title: string }

export type PendingTaskRef =
  | { kind: "track"; task: TrackedTopLevelTaskRef }
  | { kind: "skip"; reason: "explicit_resume" }
  | { kind: "skip"; reason: "ambiguous_task_key"; task: TrackedTopLevelTaskRef }

export interface SessionState {
  lastEventWasAbortError?: boolean
  skipNextIdleAfterRuntimeErrorRetry?: boolean
  lastContinuationInjectedAt?: number
  isInjectingContinuation?: boolean
  promptFailureCount: number
  lastFailureAt?: number
  pendingRetryTimer?: ReturnType<typeof setTimeout>
  waitingForFinalWaveApproval?: boolean
  pendingFinalWaveTaskCount?: number
  approvedFinalWaveTaskCount?: number
  awaitingToolProgressAfterContinuation?: boolean
  iterationsSinceLastToolProgress?: number
  lastToolProgressAt?: number
  stalledContinuationReason?: string
  stalledContinuationPlanPath?: string
  activeContinuationPlanPath?: string
  verifiedTaskKeys?: Set<string>
}
