import { describe, expect, test, mock, beforeEach } from "bun:test"
import { checkRepoHeuristic, clearRepoCache } from "./repo-heuristic"

describe("checkRepoHeuristic", () => {
  beforeEach(() => {
    clearRepoCache()
  })

  describe("#given a GitHub source", () => {
    test("#when repo meets age and star criteria #then allows", async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              full_name: "obra/superpowers",
              created_at: "2020-01-01T00:00:00Z",
              stargazers_count: 1000,
              description: "Test repo",
            }),
            { status: 200 },
          ),
        ),
      ) as typeof fetch

      try {
        const result = await checkRepoHeuristic(
          "github.com/obra/superpowers",
          30,
          10,
        )
        expect(result.allowed).toBe(true)
        expect(result.riskLevel).toBe("low")
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test("#when repo is young and has few stars #then blocks", async () => {
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
        const result = await checkRepoHeuristic(
          "github.com/unknown/new-repo",
          30,
          10,
        )
        expect(result.allowed).toBe(false)
        expect(result.riskLevel).toBe("high")
        expect(result.requiresConfirmation).toBe(true)
        expect(result.reason).toContain("days old")
        expect(result.reason).toContain("stars")
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test("#when repo is young but has many stars #then warns", async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              full_name: "popular/new-repo",
              created_at: new Date(
                Date.now() - 5 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              stargazers_count: 100,
              description: "Popular new repo",
            }),
            { status: 200 },
          ),
        ),
      ) as typeof fetch

      try {
        const result = await checkRepoHeuristic(
          "github.com/popular/new-repo",
          30,
          10,
        )
        expect(result.allowed).toBe(true)
        expect(result.riskLevel).toBe("medium")
        expect(result.requiresConfirmation).toBe(true)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test("#when API fails #then requires confirmation", async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("Network error")),
      ) as typeof fetch

      try {
        const result = await checkRepoHeuristic(
          "github.com/obra/superpowers",
          30,
          10,
        )
        expect(result.allowed).toBe(true)
        expect(result.requiresConfirmation).toBe(true)
        expect(result.riskLevel).toBe("medium")
        expect(result.reason).toContain("Could not fetch repo info")
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test("#when non-GitHub source #then returns null info", async () => {
      const result = await checkRepoHeuristic(
        "npm:some-package",
        30,
        10,
      )
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe("medium")
    })
  })
})
