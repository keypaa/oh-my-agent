import type { ProvenanceCheckResult, RepoInfo } from "./types"

const cache = new Map<string, { info: RepoInfo; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

function extractGitHubRepo(source: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
    /^([^/]+)\/([^/]+)$/,
  ]

  for (const pattern of patterns) {
    const m = source.match(pattern)
    if (m) {
      return { owner: m[1], repo: m[2] }
    }
  }
  return null
}

function getCached(owner: string, repo: string): RepoInfo | null {
  const key = `${owner}/${repo}`
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.info
  }
  return null
}

function setCache(owner: string, repo: string, info: RepoInfo): void {
  const key = `${owner}/${repo}`
  cache.set(key, { info, timestamp: Date.now() })
}

export async function fetchRepoInfo(
  source: string,
): Promise<RepoInfo | null> {
  const parsed = extractGitHubRepo(source)
  if (!parsed) return null

  const cached = getCached(parsed.owner, parsed.repo)
  if (cached) return cached

  try {
    const response = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "oh-my-agent-provenance-guard",
        },
        signal: AbortSignal.timeout(5000),
      },
    )

    if (!response.ok) return null

    const data = (await response.json()) as {
      full_name: string
      created_at: string
      stargazers_count: number
      description: string | null
    }

    const info: RepoInfo = {
      fullName: data.full_name,
      createdAt: data.created_at,
      stargazersCount: data.stargazers_count,
      description: data.description,
    }

    setCache(parsed.owner, parsed.repo, info)
    return info
  } catch {
    return null
  }
}

export async function checkRepoHeuristic(
  source: string,
  minAgeDays: number,
  minStars: number,
): Promise<ProvenanceCheckResult> {
  const info = await fetchRepoInfo(source)

  if (!info) {
    return {
      allowed: true,
      reason: "Could not fetch repo info; untrusted source requires confirmation",
      requiresConfirmation: true,
      riskLevel: "medium",
    }
  }

  const ageDays = Math.floor(
    (Date.now() - new Date(info.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  )
  const isYoung = ageDays < minAgeDays
  const hasFewStars = info.stargazersCount < minStars

  if (isYoung && hasFewStars) {
    return {
      allowed: false,
      reason: `Repo is ${ageDays} days old with ${info.stargazersCount} stars (minimum: ${minAgeDays} days, ${minStars} stars)`,
      requiresConfirmation: true,
      riskLevel: "high",
    }
  }

  if (isYoung || hasFewStars) {
    return {
      allowed: true,
      reason: `Repo is ${ageDays} days old with ${info.stargazersCount} stars`,
      requiresConfirmation: true,
      riskLevel: "medium",
    }
  }

  return {
    allowed: true,
    reason: `Repo meets trust criteria (${ageDays} days old, ${info.stargazersCount} stars)`,
    riskLevel: "low",
  }
}

export function clearRepoCache(): void {
  cache.clear()
}
