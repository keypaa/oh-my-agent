import type { ProvenanceCheckResult } from "./types"

function matchesPattern(source: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    const regex = new RegExp(
      "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
    )
    return regex.test(source)
  }
  return source === pattern
}

export function verifySource(
  source: string,
  trustedSources: string[],
): ProvenanceCheckResult {
  for (const pattern of trustedSources) {
    if (matchesPattern(source, pattern)) {
      return {
        allowed: true,
        riskLevel: "low",
      }
    }
  }

  return {
    allowed: false,
    reason: `Source '${source}' is not in the trusted sources list`,
    requiresConfirmation: true,
    riskLevel: "medium",
  }
}
