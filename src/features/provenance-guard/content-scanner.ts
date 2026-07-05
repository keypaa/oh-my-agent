import { findKnownSecrets, findHighEntropyStrings } from "../../hooks/secret-scanner/patterns"
import type { ProvenanceCheckResult } from "./types"

export function scanContent(content: string): ProvenanceCheckResult {
  const knownMatches = findKnownSecrets(content)
  const highEntropyMatches = findHighEntropyStrings(content)

  if (knownMatches.length === 0 && highEntropyMatches.length === 0) {
    return {
      allowed: true,
      riskLevel: "low",
    }
  }

  const reasons: string[] = []

  for (const m of knownMatches) {
    reasons.push(`Contains ${m.pattern.name}: ${m.match.slice(0, 12)}...`)
  }

  for (const h of highEntropyMatches) {
    reasons.push(`High-entropy string detected: ${h.slice(0, 12)}...`)
  }

  if (knownMatches.length > 0) {
    return {
      allowed: false,
      reason: reasons.join("; "),
      riskLevel: "high",
    }
  }

  return {
    allowed: true,
    reason: reasons.join("; "),
    requiresConfirmation: true,
    riskLevel: "medium",
  }
}
