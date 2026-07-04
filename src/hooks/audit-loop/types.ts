import type { AuditLoopConfig } from "../../config"

export type AuditCycleResult = {
  approved: boolean
  theAuditorVerdict: string
  coldEyesVerdict?: string
  issues: string[]
}

export type AuditLoopState = {
  active: boolean
  sessionID: string
  cycleCount: number
  maxCycles: number
  currentVerifier?: "the-auditor" | "cold-eyes"
  theAuditorSessionID?: string
  coldEyesSessionID?: string
  originalTask: string
  agentClaims: string
  changedFiles: string
  plan?: string
  startedAt: string
}

export type AuditLoopHook = {
  event: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
  getState: () => AuditLoopState | null
  startAudit: (sessionID: string, context: AuditContext) => boolean
  cancelAudit: () => boolean
}

export type AuditContext = {
  originalTask: string
  agentClaims: string
  changedFiles: string
  plan?: string
}

export type VerifierVerdict = {
  approved: boolean
  summary: string
  issues: string[]
}
