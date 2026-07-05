import { describe, expect, test, mock, beforeEach } from "bun:test"
import { createProvenanceGuard } from "./index"
import { clearRepoCache } from "./repo-heuristic"
import type { ProvenanceGuardConfig } from "./config-schema"

const DEFAULT_CONFIG: ProvenanceGuardConfig = {
  enabled: true,
  trusted_sources: ["github.com/obra/superpowers", "github.com/prime-radiant-inc/*"],
  min_repo_age_days: 30,
  min_stars: 10,
  require_permission_review: true,
}

function createGuard(overrides?: Partial<ProvenanceGuardConfig>) {
  return createProvenanceGuard({ ...DEFAULT_CONFIG, ...overrides })
}

describe("createProvenanceGuard", () => {
  beforeEach(() => {
    clearRepoCache()
  })

  describe("#given disabled guard", () => {
    test("#when any check #then allows everything", async () => {
      const guard = await createGuard({ enabled: false })

      const sourceResult = await guard.checkSource("github.com/unknown/evil")
      expect(sourceResult.allowed).toBe(true)

      const contentResult = guard.checkContent('AWS_KEY="AKIAIOSFODNN7EXAMPLE"')
      expect(contentResult.allowed).toBe(true)

      const permissionResult = guard.checkPermissions(
        "---\nallowed-tools:\n  - read\n---",
      )
      expect(permissionResult.allowed).toBe(true)
    })
  })

  describe("#when source is trusted", () => {
    test("#then checkSource allows with low risk", async () => {
      const guard = await createGuard()
      const result = await guard.checkSource("github.com/obra/superpowers")
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe("low")
    })
  })

  describe("#when source is untrusted", () => {
    test("#then checkSource requires confirmation", async () => {
      const guard = await createGuard()
      const result = await guard.checkSource("github.com/unknown/evil-repo")
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe("medium")
      expect(result.requiresConfirmation).toBe(true)
    })
  })

  describe("#when content has secrets", () => {
    test("#then checkContent blocks", async () => {
      const guard = await createGuard({ enabled: true })
      const result = guard.checkContent('AKIAIOSFODNN7EXAMPLE')
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe("high")
    })
  })

  describe("#when content has permissions", () => {
    test("#then checkPermissions requires approval", async () => {
      const guard = await createGuard({ enabled: true })
      const content =
        "---\nname: test\nallowed-tools:\n  - read\n---\n\n# Skill"
      const result = guard.checkPermissions(content)
      expect(result.allowed).toBe(true)
      expect(result.requiresApproval).toBe(true)
      expect(result.permissions).toContain("tool:read")
    })
  })

  describe("#when fullCheck on untrusted source with secrets", () => {
    test("#then returns high risk", async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              full_name: "unknown/new-repo",
              created_at: new Date(
                Date.now() - 5 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              stargazers_count: 2,
              description: "New repo",
            }),
            { status: 200 },
          ),
        ),
      ) as typeof fetch

      try {
        const guard = await createGuard()
        const result = await guard.fullCheck(
          "github.com/unknown/new-repo",
          'AWS_KEY="AKIAIOSFODNN7EXAMPLE"',
        )
        expect(result.riskLevel).toBe("high")
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})
