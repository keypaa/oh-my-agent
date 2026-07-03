type IsServerRunningOptions = {
  fetchImplementation?: typeof fetch
  state?: {
    serverAvailable: boolean | null
    serverCheckUrl: string | null
    serverRunningInProcess: boolean
  }
}

export async function isServerRunning(serverUrl: string, options?: IsServerRunningOptions): Promise<boolean> {
  throw new Error("tmux-core was pruned — stub implementation")
}
