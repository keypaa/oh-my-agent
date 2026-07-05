import type { SecretScannerSeverityConfig } from "../../features/security-guards/config-schema"

import type { PatternMatch } from "./patterns"

export type SeverityResult = {
  shouldBlock: boolean
  shouldWarn: boolean
  message: string
}

export function evaluateSeverity(
  knownMatches: PatternMatch[],
  highEntropyMatches: string[],
  severityConfig: SecretScannerSeverityConfig,
): SeverityResult {
  const blockMessages: string[] = []
  const warnMessages: string[] = []

  if (severityConfig.known_patterns === "block") {
    for (const m of knownMatches) {
      blockMessages.push(`Detected ${m.pattern.name}: ${m.match.slice(0, 8)}...`)
    }
  } else if (severityConfig.known_patterns === "warn" && knownMatches.length > 0) {
    for (const m of knownMatches) {
      warnMessages.push(`Possible ${m.pattern.name}: ${m.match.slice(0, 8)}...`)
    }
  }

  if (severityConfig.entropy === "block") {
    for (const h of highEntropyMatches) {
      blockMessages.push(`High-entropy string detected: ${h.slice(0, 12)}...`)
    }
  } else if (severityConfig.entropy === "warn" && highEntropyMatches.length > 0) {
    for (const h of highEntropyMatches) {
      warnMessages.push(`Possible secret (high entropy): ${h.slice(0, 12)}...`)
    }
  }

  const allMessages = [...blockMessages, ...warnMessages]
  return {
    shouldBlock: blockMessages.length > 0,
    shouldWarn: warnMessages.length > 0 && blockMessages.length === 0,
    message: allMessages.length > 0
      ? `Secret scanner detected potential secrets:\n${allMessages.join("\n")}`
      : "",
  }
}
