import { describe, it, expect } from "bun:test"

describe("model-resolution check", () => {
  describe("parseProviderModel", () => {
    it("splits chutes model IDs at the provider separator", async () => {
      const { parseProviderModel } = await import("./model-resolution")

      // #given a provider-prefixed model whose model ID contains a slash
      const value = "chutes/deepseek-ai/DeepSeek-V3.2-TEE"

      // #when parsing the provider and model IDs
      const result = parseProviderModel(value)

      // #then only the first slash separates the provider
      expect(result).toEqual({ providerID: "chutes", modelID: "deepseek-ai/DeepSeek-V3.2-TEE" })
    })

    it("splits simple provider model IDs", async () => {
      const { parseProviderModel } = await import("./model-resolution")

      // #given a provider-prefixed model without extra slashes
      const value = "openai/gpt-5"

      // #when parsing the provider and model IDs
      const result = parseProviderModel(value)

      // #then provider and model are split normally
      expect(result).toEqual({ providerID: "openai", modelID: "gpt-5" })
    })

    it("splits synthetic provider model IDs at the provider separator", async () => {
      const { parseProviderModel } = await import("./model-resolution")

      // #given a synthetic provider model whose model ID contains a slash
      const value = "synthetic/hf:zai-org/GLM-5.1"

      // #when parsing the provider and model IDs
      const result = parseProviderModel(value)

      // #then only the first slash separates the provider
      expect(result).toEqual({ providerID: "synthetic", modelID: "hf:zai-org/GLM-5.1" })
    })

    it("returns null for invalid model IDs", async () => {
      const { parseProviderModel } = await import("./model-resolution")

      expect(parseProviderModel("")).toBeNull()
      expect(parseProviderModel("no-slash")).toBeNull()
      expect(parseProviderModel("/no-provider")).toBeNull()
      expect(parseProviderModel("provider/")).toBeNull()
    })
  })

  describe("getModelResolutionInfo", () => {
    it("returns empty agents and categories when requirements are empty", async () => {
      const { getModelResolutionInfo } = await import("./model-resolution")

      const info = getModelResolutionInfo()

      // then: With empty AGENT_MODEL_REQUIREMENTS and CATEGORY_MODEL_REQUIREMENTS,
      // the functions return empty arrays since there are no hardcoded chains to iterate
      expect(info.agents).toEqual([])
      expect(info.categories).toEqual([])
    })
  })

  describe("getModelResolutionInfoWithOverrides", () => {
    it("returns empty agents and categories when requirements are empty regardless of config", async () => {
      const { getModelResolutionInfoWithOverrides } = await import("./model-resolution")

      // given: Config with overrides, but requirements are empty
      const mockConfig = {
        agents: {
          oracle: { model: "anthropic/claude-opus-4-7" },
        },
        categories: {
          "visual-engineering": { model: "openai/gpt-5.4" },
        },
      }

      const info = getModelResolutionInfoWithOverrides(mockConfig)

      // then: Overrides are only applied to entries that exist in requirements.
      // With empty requirements, no entries are produced.
      expect(info.agents).toEqual([])
      expect(info.categories).toEqual([])
    })

    it("returns empty info even when config provides variants", async () => {
      const { getModelResolutionInfoWithOverrides } = await import("./model-resolution")

      const mockConfig = {
        agents: {
          oracle: { model: "openai/gpt-5.4", variant: "xhigh" },
        },
        categories: {
          "visual-engineering": { model: "google/gemini-3-flash-preview", variant: "high" },
        },
      }

      const info = getModelResolutionInfoWithOverrides(mockConfig)

      expect(info.agents).toEqual([])
      expect(info.categories).toEqual([])
    })

    it("returns empty info when config provides complex overrides", async () => {
      const { getModelResolutionInfoWithOverrides } = await import("./model-resolution")

      const info = getModelResolutionInfoWithOverrides({
        categories: {
          "visual-engineering": { model: "google/gemini-3.1-pro-high" },
        },
      })

      expect(info.categories).toEqual([])
    })
  })

  describe("collectCapabilityResolutionIssues", () => {
    it("returns no issues when info has no entries", async () => {
      const { collectCapabilityResolutionIssues, getModelResolutionInfoWithOverrides } = await import("./model-resolution")

      const info = getModelResolutionInfoWithOverrides({
        agents: {
          oracle: { model: "custom/unknown-llm" },
        },
      })

      const issues = collectCapabilityResolutionIssues(info)

      // With empty requirements, no entries exist to produce issues
      expect(issues).toHaveLength(0)
    })

    it("returns no issues for any config when requirements are empty", async () => {
      const { collectCapabilityResolutionIssues, getModelResolutionInfoWithOverrides } = await import("./model-resolution")

      const info = getModelResolutionInfoWithOverrides({
        agents: {
          sisyphus: { model: "kimi-for-coding/k2pb" },
          metis: { model: "github-copilot/claude-opus-4.7" },
        },
        categories: {
          "visual-engineering": { model: "github-copilot/claude-opus-4.7" },
          artistry: { model: "github-copilot/claude-opus-4.7" },
        },
      })

      const issues = collectCapabilityResolutionIssues(info)
      expect(issues).toHaveLength(0)
    })
  })

  describe("checkModelResolution", () => {
    it("returns pass or warn status with zero agent and category counts", async () => {
      const { checkModelResolution } = await import("./model-resolution")

      const result = await checkModelResolution()

      // then: With empty requirements, should report 0 agents and 0 categories
      expect(["pass", "warn"]).toContain(result.status)
      expect(result.message).toMatch(/0 agents?, 0 categories?/)
    })

    it("includes resolution details in verbose mode details array", async () => {
      const { checkModelResolution } = await import("./model-resolution")

      const result = await checkModelResolution()

      // then: Details should contain section headers even with empty requirements
      const details = result.details
      expect(details).toBeDefined()
      expect(details!.length).toBeGreaterThan(0)
      expect(details!.some((d) => d.includes("Available Models"))).toBe(true)
      expect(details!.some((d) => d.includes("Configured Models"))).toBe(true)
    })
  })
})
