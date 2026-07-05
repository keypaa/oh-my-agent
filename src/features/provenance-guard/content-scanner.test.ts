import { describe, expect, test } from "bun:test"
import { scanContent } from "./content-scanner"

describe("scanContent", () => {
  describe("#given clean content", () => {
    test("#when no secrets #then allows", () => {
      const result = scanContent("# My Skill\n\nThis is a safe skill.")
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe("low")
    })
  })

  describe("#given content with known secrets", () => {
    test("#when AWS key present #then blocks", () => {
      const result = scanContent('AWS_KEY="AKIAIOSFODNN7EXAMPLE"')
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe("high")
      expect(result.reason).toContain("AWS Access Key")
    })

    test("#when OpenAI key present #then blocks", () => {
      const result = scanContent("api_key: sk-proj1234567890abcdefghijklmnop")
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe("high")
      expect(result.reason).toContain("OpenAI API Key")
    })

    test("#when Anthropic key present #then blocks", () => {
      const result = scanContent("key=sk-ant-api03-abcdefghijklmnopqrstuvwx")
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe("high")
      expect(result.reason).toContain("Anthropic API Key")
    })

    test("#when private key present #then blocks", () => {
      const result = scanContent("-----BEGIN RSA PRIVATE KEY-----\nMIIE...")
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe("high")
      expect(result.reason).toContain("Private Key")
    })
  })

  describe("#given content with high-entropy strings only", () => {
    test("#when high entropy string #then allows with confirmation", () => {
      const result = scanContent("token: aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5z")
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe("medium")
      expect(result.requiresConfirmation).toBe(true)
      expect(result.reason).toContain("High-entropy string")
    })
  })
})
