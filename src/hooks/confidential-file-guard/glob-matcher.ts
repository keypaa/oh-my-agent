import picomatch from "picomatch"

const cache = new Map<string, picomatch.Matcher>()

export function matchesGlob(filePath: string, patterns: string[]): boolean {
  const key = patterns.sort().join("\0")
  let matcher = cache.get(key)
  if (!matcher) {
    matcher = picomatch(patterns, { dot: true })
    cache.set(key, matcher)
  }
  return matcher(filePath)
}

export function filterBlockedPaths(
  filePaths: string[],
  patterns: string[],
): string[] {
  return filePaths.filter((p) => !matchesGlob(p, patterns))
}
