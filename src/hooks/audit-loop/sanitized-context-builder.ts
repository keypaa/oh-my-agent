import type { AuditContext } from "./types"

type SanitizedInput = Pick<AuditContext, "originalTask" | "changedFiles">

/**
 * Builds sanitized context for Cold-Eyes (Verifier 2).
 *
 * The key insight: Cold-Eyes must NOT see the agent's self-report or
 * Verifier 1's findings, to avoid anchoring bias.
 *
 * Cold-Eyes receives ONLY:
 * - Original task description
 * - Changed files (diff content)
 */
export function buildSanitizedContext(context: SanitizedInput): string {
  return `# Verification Request (Cold-Eyes - Unbiased Second Verifier)

## Original Task
${context.originalTask}

## Changed Files
${context.changedFiles}

---

You are Verifier 2. You have NOT seen the agent's claims or Verifier 1's report.
Independently verify: does this code fulfill the original task? Is it complete and correct?
`
}

/**
 * Builds full context for The-Auditor (Verifier 1).
 *
 * The-Auditor receives everything:
 * - Original task
 * - Agent's claims
 * - Changed files
 * - Plan (if available)
 */
export function buildFullContext(context: AuditContext): string {
  let full = `# Verification Request (The-Auditor - Work Verifier)

## Original Task
${context.originalTask}

## Agent's Claims
${context.agentClaims}

## Changed Files
${context.changedFiles}
`

  if (context.plan) {
    full += `
## Plan
${context.plan}
`
  }

  full += `
---

Verify: does this code match the spec? Are there stubs? Are tests adequate? Any hallucinations?
`

  return full
}
