export type TmuxCommandResult = {
  success: boolean
  output: string
  exitCode: number | null
}

export async function runTmuxCommand(
  _tmuxPath: string,
  _args: Array<string>,
  _options?: { retry?: number; timeoutMs?: number },
): Promise<TmuxCommandResult> {
  return { success: false, output: "", exitCode: null }
}

export async function isServerRunning(): Promise<boolean> {
  return false
}

export async function closeTmuxPane(): Promise<void> {}

export async function sweepTmuxSessionsWith(
  _deps: {
    isInsideTmux: () => boolean
    getTmuxPath: () => Promise<string | undefined | null>
    listCandidateSessions: () => Promise<string[]>
    killSession: (name: string) => Promise<boolean>
    log: (message: string, payload?: unknown) => void
  },
): Promise<string[]> {
  return []
}
