export {
  createContentHash,
  getMatcherCacheStats,
  isDuplicateByContentHash,
  isDuplicateByRealPath,
  resetMatcherCache,
  shouldApplyRule,
} from "#shared/rules-engine";
export type { MatchResult } from "#shared/rules-engine";

export interface MatcherCacheStats {
  readonly entries: number;
}
