import type { AuditLoopConfig } from "../../config"

export const HOOK_NAME = "audit-loop" as const

export const DEFAULT_MAX_CYCLES = 3

export function getMaxCycles(config?: AuditLoopConfig): number {
  return config?.max_cycles ?? DEFAULT_MAX_CYCLES
}

export function isAuditLoopEnabled(config?: AuditLoopConfig): boolean {
  return config?.enabled === true
}

export function shouldSkipVerifier2(config?: AuditLoopConfig): boolean {
  return config?.skip_verifier_2 === true
}
