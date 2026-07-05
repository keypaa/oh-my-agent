import type { ProvenanceGuardConfig } from "./config-schema"
import type { ProvenanceCheckResult } from "./types"
import { verifySource } from "./source-verifier"
import { checkRepoHeuristic } from "./repo-heuristic"
import { scanContent } from "./content-scanner"
import { reviewPermissions } from "./permission-reviewer"

export type ProvenanceGuard = {
  checkSource: (source: string) => Promise<ProvenanceCheckResult>
  checkContent: (content: string) => ProvenanceCheckResult
  checkPermissions: (content: string) => ProvenanceCheckResult
  fullCheck: (
    source: string,
    content: string,
  ) => Promise<ProvenanceCheckResult>
}

function worstRisk(...results: ProvenanceCheckResult[]): ProvenanceCheckResult {
  const order = { low: 0, medium: 1, high: 2 } as const

  let worst: ProvenanceCheckResult = results[0]
  for (const r of results) {
    if (order[r.riskLevel] > order[worst.riskLevel]) {
      worst = r
    }
  }
  return worst
}

export async function createProvenanceGuard(
  config: ProvenanceGuardConfig,
): Promise<ProvenanceGuard> {
  return {
    async checkSource(source: string): Promise<ProvenanceCheckResult> {
      if (!config.enabled) {
        return { allowed: true, riskLevel: "low" }
      }

      const sourceResult = verifySource(source, config.trusted_sources)

      if (!sourceResult.allowed) {
        const repoResult = await checkRepoHeuristic(
          source,
          config.min_repo_age_days,
          config.min_stars,
        )
        return worstRisk(sourceResult, repoResult)
      }

      return sourceResult
    },

    checkContent(content: string): ProvenanceCheckResult {
      if (!config.enabled) {
        return { allowed: true, riskLevel: "low" }
      }
      return scanContent(content)
    },

    checkPermissions(content: string): ProvenanceCheckResult {
      if (!config.enabled) {
        return { allowed: true, riskLevel: "low" }
      }
      return reviewPermissions(content, config.require_permission_review)
    },

    async fullCheck(
      source: string,
      content: string,
    ): Promise<ProvenanceCheckResult> {
      if (!config.enabled) {
        return { allowed: true, riskLevel: "low" }
      }

      const sourceResult = verifySource(source, config.trusted_sources)
      const contentResult = scanContent(content)
      const permissionResult = reviewPermissions(
        content,
        config.require_permission_review,
      )

      if (sourceResult.allowed) {
        return worstRisk(contentResult, permissionResult)
      }

      const repoResult = await checkRepoHeuristic(
        source,
        config.min_repo_age_days,
        config.min_stars,
      )

      return worstRisk(sourceResult, repoResult, contentResult, permissionResult)
    },
  }
}

export type { ProvenanceCheckResult, RiskLevel } from "./types"
export { ProvenanceGuardConfigSchema } from "./config-schema"
export type { ProvenanceGuardConfig } from "./config-schema"
