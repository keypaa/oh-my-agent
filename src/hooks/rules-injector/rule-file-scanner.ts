import { findRuleFilesRecursive as findRuleFileEntriesRecursive, safeRealpathSync } from "#shared/rules-engine";
import type { DirectoryScanEntry } from "#shared/rules-engine";

export { safeRealpathSync };

export function findRuleFilesRecursive(dir: string, results: string[]): void {
  const entries: DirectoryScanEntry[] = [];
  findRuleFileEntriesRecursive(dir, entries);
  results.push(...entries.map((entry) => entry.path));
}
