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

export async function isServerRunning(_url?: string): Promise<boolean> {
  return false
}

export async function closeTmuxPane(_paneId: string): Promise<boolean> {
  return false
}

export async function sweepTmuxSessionsWith(
  _deps: {
    isInsideTmux: () => boolean
    getTmuxPath: () => Promise<string | undefined | null>
    listCandidateSessions: () => Promise<string[]>
    killSession: (name: string) => Promise<boolean>
    log: (message: string, payload?: unknown) => void
  },
  _options?: {
    predicate?: (sessionName: string) => boolean
  },
): Promise<string[]> {
  return []
}
