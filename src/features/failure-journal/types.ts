export type FailureReporter = "the-auditor" | "cold-eyes" | "user"

export type FailurePattern =
  | "race-condition"
  | "off-by-one"
  | "stale-cache"
  | "null-reference"
  | "type-error"
  | "logic-error"
  | "performance"
  | "security"
  | "other"

export interface FailureRecord {
  id: string
  timestamp: string
  sessionId: string
  filePath: string
  rootCause: string
  pattern: FailurePattern
  fixDescription: string
  reportedBy: FailureReporter
  resolved: boolean
}
