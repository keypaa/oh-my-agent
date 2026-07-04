import type { PendingTaskRef, TrackedTopLevelTaskRef } from "./types"

export function resolvePreferredSessionId(currentSessionId?: string, trackedSessionId?: string): string {
  return currentSessionId ?? trackedSessionId ?? "<session_id>"
}

export function resolveTaskContext(
  pendingTaskRef: PendingTaskRef | undefined,
  _planPath: string,
): {
  currentTask: TrackedTopLevelTaskRef | null
  shouldSkipTaskSessionUpdate: boolean
  shouldIgnoreCurrentSessionId: boolean
} {
  if (!pendingTaskRef) {
    return {
      currentTask: null,
      shouldSkipTaskSessionUpdate: false,
      shouldIgnoreCurrentSessionId: false,
    }
  }

  if (pendingTaskRef.kind === "track") {
    return {
      currentTask: pendingTaskRef.task,
      shouldSkipTaskSessionUpdate: false,
      shouldIgnoreCurrentSessionId: false,
    }
  }

  if (pendingTaskRef.reason === "explicit_resume") {
    return {
      currentTask: null,
      shouldSkipTaskSessionUpdate: true,
      shouldIgnoreCurrentSessionId: true,
    }
  }

  return {
    currentTask: pendingTaskRef.task,
    shouldSkipTaskSessionUpdate: true,
    shouldIgnoreCurrentSessionId: true,
  }
}
