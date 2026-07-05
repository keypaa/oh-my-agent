import picomatch from "picomatch"
import type { HaruspexGuardConfig } from "../../config/schema/haruspex-guard"

export type PathVerdict = "allowed" | "denied" | "confirm"

const cache = new Map<string, picomatch.Matcher>()

function buildMatcher(patterns: string[]): picomatch.Matcher {
  const key = patterns.sort().join("\0")
  let matcher = cache.get(key)
  if (!matcher) {
    matcher = picomatch(patterns, { dot: true })
    cache.set(key, matcher)
  }
  return matcher
}

export function matchesAny(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  return buildMatcher(patterns)(filePath)
}

export function resolvePathVerdict(
  filePath: string,
  config: HaruspexGuardConfig,
): PathVerdict {
  const normalized = filePath.replace(/\\/g, "/")

  if (matchesAny(normalized, config.denied_paths)) {
    return "denied"
  }

  if (matchesAny(normalized, config.require_confirmation)) {
    return "confirm"
  }

  if (matchesAny(normalized, config.allowed_paths)) {
    return "allowed"
  }

  return "denied"
}
