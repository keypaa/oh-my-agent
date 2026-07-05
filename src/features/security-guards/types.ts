export type GuardSeverity = "block" | "warn"

export type GuardConfig = {
  enabled: boolean
}

export type ConfidentialFilesConfig = GuardConfig & {
  paths: string[]
  block_message: string
}

export type SecretScannerSeverityConfig = {
  known_patterns: GuardSeverity
  entropy: GuardSeverity
}

export type SecretScannerConfig = GuardConfig & {
  severity: SecretScannerSeverityConfig
  allowlist_patterns: string[]
  allowlist_paths: string[]
}

export type GuardResult = {
  blocked: boolean
  message?: string
  severity?: GuardSeverity
}
