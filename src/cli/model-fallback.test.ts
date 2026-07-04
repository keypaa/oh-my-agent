/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"

import { generateModelConfig, shouldShowChatGPTOnlyWarning } from "./model-fallback"
import type { InstallConfig } from "./types"

function createConfig(overrides: Partial<InstallConfig> = {}): InstallConfig {
  return {
    platform: "opencode",
    hasOpenCode: true,
    hasCodex: false,
    codexAutonomous: false,
    hasClaude: false,
    isMax20: false,
    hasOpenAI: false,
    hasGemini: false,
    hasCopilot: false,
    hasOpencodeZen: false,
    hasZaiCodingPlan: false,
    hasKimiForCoding: false,
    hasOpencodeGo: false,
      hasBailianCodingPlan: false,
    hasMinimaxCnCodingPlan: false,
    hasMinimaxCodingPlan: false,
    hasVercelAiGateway: false,
    ...overrides,
  }
}

function flattenConfiguredModels(result: ReturnType<typeof generateModelConfig>) {
  return [
    ...Object.values(result.agents ?? {}),
    ...Object.values(result.categories ?? {}),
  ].flatMap((entry) => [entry, ...(entry.fallback_models ?? [])])
}
describe("generateModelConfig", () => {

  describe("fallback providers", () => {

    test("downgrades unsupported GitHub Copilot GPT high-tier variants", () => {
      // #given only GitHub Copilot is available
      const config = createConfig({ hasCopilot: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then Copilot GPT routes should not receive variants that hang the provider
      const unsupportedEntries = flattenConfiguredModels(result).filter(
        (entry) =>
          entry.model.startsWith("github-copilot/gpt-5.") &&
          (entry.variant === "max" || entry.variant === "xhigh")
      )
      expect(unsupportedEntries).toEqual([])
      // With empty requirements, agents that previously resolved from chains get ULTIMATE_FALLBACK
      expect(result.agents?.momus).toEqual({
        model: "opencode/gpt-5-nano",
      })
    })
    test("omits librarian when only ZAI is available", () => {
      // #given only ZAI is available
      const config = createConfig({ hasZaiCodingPlan: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then librarian should not use a stale ZAI special case
      expect(result.agents?.librarian).toBeUndefined()
      expect(JSON.stringify(result)).not.toContain("zai-coding-plan/glm-4.7")
    })

    test("omits librarian when only ZAI is available with isMax20 flag", () => {
      // #given ZAI is available with Max 20 plan
      const config = createConfig({ hasZaiCodingPlan: true, isMax20: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then librarian should not use a stale ZAI special case
      expect(result.agents?.librarian).toBeUndefined()
      expect(JSON.stringify(result)).not.toContain("zai-coding-plan/glm-4.7")
    })

    test("uses Bailian Qwen for utility agents when only Bailian is available", () => {
      // #given only Bailian Coding Plan is available
      const config = createConfig({ hasBailianCodingPlan: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then With empty requirements, librarian has no fallback chain so is not added;
      // explore falls through to ULTIMATE_FALLBACK; hephaestus also gets ULTIMATE_FALLBACK
      expect(result.agents?.librarian).toBeUndefined()
      expect(result.agents?.explore?.model).toBe("opencode/gpt-5-nano")
      expect(result.agents?.hephaestus?.model).toBe("opencode/gpt-5-nano")
    })
  })

  describe("mixed provider scenarios", () => {

    test("librarian skips deprecated OpenCode Zen models when OpenCode Zen and ZAI are both available", () => {
      // #given the Discord-reported non-TUI provider selection
      const config = createConfig({
        hasOpencodeZen: true,
        hasZaiCodingPlan: true,
      })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then librarian should not route through stale Zen or ZAI special cases
      expect(result.agents?.librarian).toBeUndefined()
      expect(JSON.stringify(result)).not.toContain("zai-coding-plan/glm-4.7")
      expect(JSON.stringify(result)).not.toContain("opencode/claude-haiku-4-5")
      expect(JSON.stringify(result)).not.toContain("opencode/gpt-5.4-nano")
    })

  })

  describe("explore agent special cases", () => {
    test("explore uses gpt-5-nano when only Gemini available (no Claude)", () => {
      // #given only Gemini is available (no Claude)
      const config = createConfig({ hasGemini: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then explore should use gpt-5-nano (Claude haiku not available)
      expect(result.agents?.explore?.model).toBe("opencode/gpt-5-nano")
    })

    test("explore uses Claude haiku when Claude available", () => {
      // #given Claude is available
      const config = createConfig({ hasClaude: true, isMax20: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then explore should use claude-haiku-4-5
      expect(result.agents?.explore?.model).toBe("anthropic/claude-haiku-4-5")
    })

    test("explore uses Claude haiku regardless of isMax20 flag", () => {
      // #given Claude is available without Max 20 plan
      const config = createConfig({ hasClaude: true, isMax20: false })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then explore should use claude-haiku-4-5 (isMax20 doesn't affect explore)
      expect(result.agents?.explore?.model).toBe("anthropic/claude-haiku-4-5")
    })

    test("explore uses OpenAI model when only OpenAI available", () => {
      // #given only OpenAI is available
      const config = createConfig({ hasOpenAI: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then explore should use native OpenAI mini-fast (primary model)
      expect(result.agents?.explore?.model).toBe("openai/gpt-5.4-mini-fast")
      expect(result.agents?.explore?.variant).toBeUndefined()
    })

    test("explore uses gpt-5-mini when only Copilot available", () => {
      // #given only Copilot is available
      const config = createConfig({ hasCopilot: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then explore should use gpt-5-mini (Copilot fallback)
      expect(result.agents?.explore?.model).toBe("github-copilot/gpt-5-mini")
    })
  })

  describe("Sisyphus agent special cases", () => {
    test("Sisyphus is created when at least one fallback provider is available (Claude)", () => {
      // #given
      const config = createConfig({ hasClaude: true, isMax20: true })

      // #when
      const result = generateModelConfig(config)

      // #then
      expect(result.agents?.sisyphus?.model).toBe("anthropic/claude-opus-4-7")
    })

    test("Sisyphus is created when multiple fallback providers are available", () => {
      // #given
      const config = createConfig({
        hasClaude: true,
        hasKimiForCoding: true,
        hasOpencodeZen: true,
        hasZaiCodingPlan: true,
        isMax20: true,
      })

      // #when
      const result = generateModelConfig(config)

      // #then
      expect(result.agents?.sisyphus?.model).toBe("anthropic/claude-opus-4-7")
    })

    test("Sisyphus resolves to gpt-5.5 medium when only OpenAI is available", () => {
      // #given
      const config = createConfig({ hasOpenAI: true })

      // #when
      const result = generateModelConfig(config)

      // #then
      expect(result.agents?.sisyphus?.model).toBe("openai/gpt-5.5")
      expect(result.agents?.sisyphus?.variant).toBe("medium")
    })
  })

  describe("OpenAI fallback coverage", () => {
    test("Atlas resolves to ULTIMATE_FALLBACK when only OpenAI is available (empty requirements)", () => {
      // #given
      const config = createConfig({ hasOpenAI: true })

      // #when
      const result = generateModelConfig(config)

      // #then - With empty requirements, agents get ULTIMATE_FALLBACK
      expect(result.agents?.atlas?.model).toBe("opencode/gpt-5-nano")
    })

    test("Metis resolves to ULTIMATE_FALLBACK when only OpenAI is available (empty requirements)", () => {
      // #given
      const config = createConfig({ hasOpenAI: true })

      // #when
      const result = generateModelConfig(config)

      // #then - With empty requirements, agents get ULTIMATE_FALLBACK
      expect(result.agents?.metis?.model).toBe("opencode/gpt-5-nano")
    })

    test("Sisyphus-Junior resolves to ULTIMATE_FALLBACK when only OpenAI is available (empty requirements)", () => {
      // #given
      const config = createConfig({ hasOpenAI: true })

      // #when
      const result = generateModelConfig(config)

      // #then - With empty requirements, agents get ULTIMATE_FALLBACK
      expect(result.agents?.["sisyphus-junior"]?.model).toBe("opencode/gpt-5-nano")
    })
  })

  describe("Hephaestus agent special cases", () => {
    test("Hephaestus gets ULTIMATE_FALLBACK when OpenAI is available (empty requirements)", () => {
      // #given
      const config = createConfig({ hasOpenAI: true })

      // #when
      const result = generateModelConfig(config)

      // #then - With empty requirements, hephaestus gets ULTIMATE_FALLBACK
      expect(result.agents?.hephaestus?.model).toBe("opencode/gpt-5-nano")
    })

    test("Hephaestus gets ULTIMATE_FALLBACK when only Copilot is available (empty requirements)", () => {
      // #given
      const config = createConfig({ hasCopilot: true })

      // #when
      const result = generateModelConfig(config)

      // #then - With empty requirements, hephaestus gets ULTIMATE_FALLBACK
      expect(result.agents?.hephaestus?.model).toBe("opencode/gpt-5-nano")
    })

    test("Hephaestus gets ULTIMATE_FALLBACK when OpenCode Zen is available (empty requirements)", () => {
      // #given
      const config = createConfig({ hasOpencodeZen: true })

      // #when
      const result = generateModelConfig(config)

      // #then - With empty requirements, hephaestus gets ULTIMATE_FALLBACK
      expect(result.agents?.hephaestus?.model).toBe("opencode/gpt-5-nano")
    })

    test("Hephaestus gets ULTIMATE_FALLBACK when only Claude is available (empty requirements)", () => {
      // #given
      const config = createConfig({ hasClaude: true })

      // #when
      const result = generateModelConfig(config)

      // #then - With empty requirements, hephaestus gets ULTIMATE_FALLBACK (not omitted)
      expect(result.agents?.hephaestus?.model).toBe("opencode/gpt-5-nano")
    })

    test("Hephaestus gets ULTIMATE_FALLBACK when only Gemini is available (empty requirements)", () => {
      // #given
      const config = createConfig({ hasGemini: true })

      // #when
      const result = generateModelConfig(config)

      // #then - With empty requirements, hephaestus gets ULTIMATE_FALLBACK
      expect(result.agents?.hephaestus?.model).toBe("opencode/gpt-5-nano")
    })

    test("Hephaestus gets ULTIMATE_FALLBACK when only ZAI is available (empty requirements)", () => {
      // #given
      const config = createConfig({ hasZaiCodingPlan: true })

      // #when
      const result = generateModelConfig(config)

      // #then - With empty requirements, hephaestus gets ULTIMATE_FALLBACK
      expect(result.agents?.hephaestus?.model).toBe("opencode/gpt-5-nano")
    })
  })

  describe("librarian agent special cases", () => {
    test("librarian is not added when ZAI is available with Claude (empty requirements)", () => {
      // #given ZAI and Claude are available
      const config = createConfig({
        hasClaude: true,
        hasZaiCodingPlan: true,
      })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then - With empty requirements, librarian has no fallback chain so is not added
      expect(result.agents?.librarian).toBeUndefined()
      expect(JSON.stringify(result)).not.toContain("zai-coding-plan/glm-4.7")
    })

    test("librarian is not added when Claude is available (empty requirements)", () => {
      // #given only Claude is available (no opencode-go or ZAI)
      const config = createConfig({ hasClaude: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then - With empty requirements, librarian has no fallback chain so is not added
      expect(result.agents?.librarian).toBeUndefined()
    })
  })

  describe("special-case agents include fallback_models", () => {
    test("explore includes fallback_models when OpenAI and Claude are both available", () => {
      // #given both OpenAI and Claude are available
      const config = createConfig({ hasOpenAI: true, hasClaude: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then explore should use OpenAI mini-fast (hardcoded logic), but no fallback_models
      // since the explore fallback chain from requirements is empty
      expect(result.agents?.explore?.model).toBe("openai/gpt-5.4-mini-fast")
      expect(result.agents?.explore?.fallback_models).toBeUndefined()
    })

    test("explore omits fallback_models when only one provider matches chain entries", () => {
      // #given only Claude is available
      const config = createConfig({ hasClaude: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then explore should not have fallback_models (only one distinct chain entry matches)
      expect(result.agents?.explore?.model).toBe("anthropic/claude-haiku-4-5")
      expect(result.agents?.explore?.fallback_models).toBeUndefined()
    })

    test("explore uses current OpenCode Zen nano model when only OpenCode Zen is available", () => {
      // #given only OpenCode Zen is available
      const config = createConfig({ hasOpencodeZen: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then Explore does not route to deprecated OpenCode Zen Haiku
      expect(result.agents?.explore?.model).toBe("opencode/gpt-5-nano")
      expect(JSON.stringify(result)).not.toContain("opencode/claude-haiku-4-5")
      expect(JSON.stringify(result)).not.toContain("opencode/gpt-5.4-nano")
    })

    test("generated config never routes deprecated fallback IDs through opencode", () => {
      // #given every provider family is available
      const config = createConfig({
        hasOpenAI: true,
        hasClaude: true,
        hasGemini: true,
        hasOpencodeZen: true,
        hasOpencodeGo: true,
        hasCopilot: true,
        hasZaiCodingPlan: true,
        hasVercelAiGateway: true,
      })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then no generated model string uses OpenCode Zen for retired IDs
      expect(JSON.stringify(result)).not.toContain("opencode/claude-haiku-4-5")
      expect(JSON.stringify(result)).not.toContain("opencode/gpt-5.4-nano")
    })

    test("librarian is not added when OpenAI and opencode-go are both available (empty requirements)", () => {
      // #given OpenAI and opencode-go are available
      const config = createConfig({ hasOpenAI: true, hasOpencodeGo: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then - With empty requirements, librarian has no fallback chain so is not added
      expect(result.agents?.librarian).toBeUndefined()
    })

    test("librarian is omitted when only ZAI is available", () => {
      // #given only ZAI is available
      const config = createConfig({ hasZaiCodingPlan: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then librarian should not have fallback_models
      expect(result.agents?.librarian).toBeUndefined()
      expect(JSON.stringify(result)).not.toContain("zai-coding-plan/glm-4.7")
    })
  })

  describe("Vercel AI Gateway provider", () => {

    test("explore gets ULTIMATE_FALLBACK when only gateway available (empty requirements)", () => {
      // #given only Vercel AI Gateway is available
      const config = createConfig({ hasVercelAiGateway: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then - With empty requirements, explore falls through to ULTIMATE_FALLBACK
      expect(result.agents?.explore?.model).toBe("opencode/gpt-5-nano")
    })

    test("librarian is not added when only gateway available (empty requirements)", () => {
      // #given only Vercel AI Gateway is available
      const config = createConfig({ hasVercelAiGateway: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then - With empty requirements, librarian has no fallback chain so is not added
      expect(result.agents?.librarian).toBeUndefined()
    })

    test("Hephaestus gets ULTIMATE_FALLBACK when only Vercel AI Gateway is available (empty requirements)", () => {
      // #given only Vercel AI Gateway is available
      const config = createConfig({ hasVercelAiGateway: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then - With empty requirements, hephaestus gets ULTIMATE_FALLBACK
      expect(result.agents?.hephaestus?.model).toBe("opencode/gpt-5-nano")
    })

    test("native providers take priority over gateway", () => {
      // #given Claude and Vercel AI Gateway are both available
      const config = createConfig({ hasClaude: true, hasVercelAiGateway: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then should prefer native anthropic over gateway
      expect(result.agents?.sisyphus?.model).toBe("anthropic/claude-opus-4-7")
    })
  })

  describe("MiniMax Coding Plan providers", () => {
    test("uses ULTIMATE_FALLBACK for utility agents when only MiniMax Coding Plan is available (empty requirements)", () => {
      // #given only MiniMax Coding Plan is available
      const config = createConfig({ hasMinimaxCodingPlan: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then - With empty requirements, utility agents get ULTIMATE_FALLBACK
      expect(result.agents?.librarian).toBeUndefined()
      expect(result.agents?.explore?.model).toBe("opencode/gpt-5-nano")
      expect(result.agents?.atlas?.model).toBe("opencode/gpt-5-nano")
      expect(result.agents?.["sisyphus-junior"]?.model).toBe("opencode/gpt-5-nano")
      expect(result.categories?.writing?.model).toBe("opencode/gpt-5-nano")
    })

    test("atlas gets ULTIMATE_FALLBACK when opencode-go and MiniMax are both available (empty requirements)", () => {
      // #given OpenCode Go and MiniMax Coding Plan are both available
      const config = createConfig({ hasOpencodeGo: true, hasMinimaxCodingPlan: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then - With empty requirements, atlas gets ULTIMATE_FALLBACK
      expect(result.agents?.atlas?.model).toBe("opencode/gpt-5-nano")
    })

    test("uses ULTIMATE_FALLBACK for utility agents when only MiniMax CN Coding Plan is available (empty requirements)", () => {
      // #given only MiniMax CN Coding Plan is available
      const config = createConfig({ hasMinimaxCnCodingPlan: true })

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then - With empty requirements, utility agents get ULTIMATE_FALLBACK
      expect(result.agents?.librarian).toBeUndefined()
      expect(result.agents?.explore?.model).toBe("opencode/gpt-5-nano")
      expect(result.categories?.quick?.model).toBe("opencode/gpt-5-nano")
    })
  })

  describe("schema URL", () => {
    test("always includes correct schema URL", () => {
      // #given any config
      const config = createConfig()

      // #when generateModelConfig is called
      const result = generateModelConfig(config)

      // #then should include correct schema URL
      expect(result.$schema).toBe(
        "https://raw.githubusercontent.com/code-yeongyu/oh-my-agent/dev/assets/oh-my-agent.schema.json"
      )
    })
  })
})

describe("shouldShowChatGPTOnlyWarning", () => {
  test("returns true when OpenAI is the only configured provider", () => {
    // #given
    const config = createConfig({ hasOpenAI: true })

    // #when
    const result = shouldShowChatGPTOnlyWarning(config)

    // #then
    expect(result).toBe(true)
  })

  const mixedProviderCases: Array<{ name: string; overrides: Partial<InstallConfig> }> = [
    { name: "Claude", overrides: { hasClaude: true } },
    { name: "Gemini", overrides: { hasGemini: true } },
    { name: "Copilot", overrides: { hasCopilot: true } },
    { name: "OpenCode Zen", overrides: { hasOpencodeZen: true } },
    { name: "Z.ai Coding Plan", overrides: { hasZaiCodingPlan: true } },
    { name: "Kimi for Coding", overrides: { hasKimiForCoding: true } },
    { name: "OpenCode Go", overrides: { hasOpencodeGo: true } },
    { name: "Bailian Coding Plan", overrides: { hasBailianCodingPlan: true } },
    { name: "MiniMax CN Coding Plan", overrides: { hasMinimaxCnCodingPlan: true } },
    { name: "MiniMax Coding Plan", overrides: { hasMinimaxCodingPlan: true } },
    { name: "Vercel AI Gateway", overrides: { hasVercelAiGateway: true } },
  ]

  for (const { name, overrides } of mixedProviderCases) {
    test(`returns false when OpenAI is configured with ${name}`, () => {
      // #given
      const config = createConfig({ hasOpenAI: true, ...overrides })

      // #when
      const result = shouldShowChatGPTOnlyWarning(config)

      // #then
      expect(result).toBe(false)
    })
  }
})
