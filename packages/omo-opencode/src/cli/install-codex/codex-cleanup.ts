export interface CodexCleanupResult {
  readonly codexHome: string
  readonly configPath: string
  readonly configChanged: boolean
  readonly configBackupPath?: string
  readonly removedPaths: string[]
  readonly skippedPaths: Array<{ path: string; reason: string }>
  readonly removedAgentLinks: string[]
  readonly skippedAgentLinks: string[]
  readonly projectCleanup: { changed: boolean; configPath?: string; artifacts: Array<{ path: string }> }
}

export async function cleanupCodexLight(_options: {
  codexHome?: string
  projectDirectory?: string
}): Promise<CodexCleanupResult> {
  return {
    codexHome: _options.codexHome ?? "",
    configPath: "",
    configChanged: false,
    removedPaths: [],
    skippedPaths: [],
    removedAgentLinks: [],
    skippedAgentLinks: [],
    projectCleanup: { changed: false, artifacts: [] },
  }
}
