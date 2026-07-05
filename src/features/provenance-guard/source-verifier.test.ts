import { describe, expect, test } from "bun:test"
import { verifySource } from "./source-verifier"

describe("verifySource", () => {
  describe("#given trusted sources list", () => {
    test("#when exact match #then allows", () => {
      const result = verifySource("github.com/obra/superpowers", [
        "github.com/obra/superpowers",
      ])
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe("low")
    })

    test("#when wildcard match #then allows", () => {
      const result = verifySource("github.com/prime-radiant-inc/any-repo", [
        "github.com/prime-radiant-inc/*",
      ])
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe("low")
    })

    test("#when no match #then blocks", () => {
      const result = verifySource("github.com/unknown/evil-repo", [
        "github.com/obra/superpowers",
      ])
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe("medium")
      expect(result.requiresConfirmation).toBe(true)
      expect(result.reason).toContain("not in the trusted sources list")
    })

    test("#when multiple patterns and one matches #then allows", () => {
      const result = verifySource("github.com/obra/superpowers", [
        "github.com/other/repo",
        "github.com/obra/superpowers",
      ])
      expect(result.allowed).toBe(true)
    })
  })

  describe("#given empty trusted list", () => {
    test("#when no trusted sources #then blocks everything", () => {
      const result = verifySource("github.com/obra/superpowers", [])
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe("medium")
    })
  })
})
