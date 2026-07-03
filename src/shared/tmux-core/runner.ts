export type TmuxCommandResult = {
  success: boolean
  output: string
  stdout: string
  stderr: string
  exitCode: number
}

type RunTmuxOptions = {
  retry?: number
  timeoutMs?: number
}

export async function runTmuxCommand(tmuxPath: string, args: string[], options?: RunTmuxOptions): Promise<TmuxCommandResult> {
  throw new Error("tmux-core was pruned — stub implementation")
}
