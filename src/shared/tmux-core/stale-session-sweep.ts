export type SweepTmuxSessionsDeps = {
  isInsideTmux: () => boolean
  getTmuxPath: () => Promise<string | null | undefined>
  listCandidateSessions: (tmux: string) => Promise<string[]>
  killSession: (sessionName: string) => Promise<boolean>
  log: (message: string, payload?: unknown) => void
}

export type SweepTmuxSessionsOptions = {
  prefix?: string
  predicate?: (sessionName: string) => boolean
}

export async function sweepTmuxSessionsWith(
  deps: SweepTmuxSessionsDeps,
  options: SweepTmuxSessionsOptions,
): Promise<string[]> {
  throw new Error("tmux-core was pruned — stub implementation")
}
