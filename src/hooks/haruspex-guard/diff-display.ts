import { log } from "../../shared"

export function computeDiffHint(
  filePath: string,
  originalContent: string | undefined,
  newContent: string | undefined,
): string | null {
  if (originalContent === undefined || newContent === undefined) return null
  if (originalContent === newContent) return null

  const oldLines = originalContent.split("\n")
  const newLines = newContent.split("\n")
  const added = newLines.filter((l) => !oldLines.includes(l)).length
  const removed = oldLines.filter((l) => !newLines.includes(l)).length

  return `[haruspex-guard] Diff for ${filePath}: +${added}/-${removed} lines`
}

export function logDiff(
  filePath: string,
  originalContent: string | undefined,
  newContent: string | undefined,
): void {
  const hint = computeDiffHint(filePath, originalContent, newContent)
  if (hint) {
    log(hint, { filePath })
  }
}
