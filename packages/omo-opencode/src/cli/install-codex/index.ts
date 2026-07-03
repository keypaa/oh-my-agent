export interface CodexInstallationDetection {
  readonly installed: boolean
  readonly codexHome: string
  readonly configPath: string
}

export async function runCodexInstaller(_options: Record<string, unknown>): Promise<void> {}

export async function detectCodexInstallation(_codexHome?: string): Promise<CodexInstallationDetection> {
  return { installed: false, codexHome: "", configPath: "" }
}

export function formatCodexInstallationWarning(_detection: CodexInstallationDetection): string | null {
  return null
}
