// Stub module - tmux-core is CUT (Completely Unused/Untested)

export interface TmuxCommandResult {
  success: boolean
  output: string
  stdout: string
  stderr: string
  exitCode: number
}

export async function runTmuxCommand(_tmuxPath: string, _args: string[], _options?: { retry?: number; timeoutMs?: number }): Promise<TmuxCommandResult> {
  return { success: false, output: "", stdout: "", stderr: "tmux-core was pruned — stub implementation", exitCode: 1 }
}

export async function isServerRunning(_serverUrl: string): Promise<boolean> {
  return false
}

export async function closeTmuxPane(_paneId: string): Promise<boolean> {
  return false
}

export interface SweepTmuxSessionsOptions {
  predicate: (sessionName: string) => boolean
}

export interface SweepTmuxSessionsContext {
  isInsideTmux: () => boolean
  getTmuxPath: () => Promise<string | null | undefined>
  listCandidateSessions: () => Promise<string[]>
  killSession: (sessionName: string) => Promise<boolean>
  log: (message: string, payload?: unknown) => void
}

export async function sweepTmuxSessionsWith(
  _ctx: SweepTmuxSessionsContext,
  _options: SweepTmuxSessionsOptions,
): Promise<string[]> {
  return []
}
