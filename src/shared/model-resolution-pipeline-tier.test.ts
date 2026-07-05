import { describe, expect, it, beforeEach } from "bun:test"
import { resolveModelPipeline, _setModelResolutionLogImplementationForTesting } from "./model-resolution-pipeline"

describe("resolveModelPipeline model_tier wiring", () => {
  beforeEach(() => {
    _setModelResolutionLogImplementationForTesting(undefined)
  })

  it("#given cheap-tier agent with expensive caller model #when resolving #then downgrades by stripping overrides", () => {
    const tierConfig = {
      cheap: ["explore", "librarian"],
      medium: ["metis"],
      expensive: ["sisyphus"],
    }

    const result = resolveModelPipeline(
      {
        intent: { uiSelectedModel: "anthropic/claude-opus-4-7" },
        constraints: { availableModels: new Set() },
      },
      { agentName: "explore", modelTierConfig: tierConfig },
    )

    // With no available models and stripped overrides, pipeline falls through to system default (undefined)
    expect(result).toBeUndefined()
  })

  it("#given cheap-tier agent with no caller model #when resolving #then passes through to core pipeline", () => {
    const tierConfig = {
      cheap: ["explore"],
      medium: [],
      expensive: [],
    }

    const result = resolveModelPipeline(
      {
        intent: { categoryDefaultModel: "openai/gpt-5.4-mini" },
        constraints: { availableModels: new Set(["openai/gpt-5.4-mini"]) },
      },
      { agentName: "explore", modelTierConfig: tierConfig },
    )

    // Without a caller model, no downgrade happens - category default is used
    expect(result).toBeDefined()
    expect(result?.model).toBe("openai/gpt-5.4-mini")
  })

  it("#given expensive-tier agent with expensive caller model #when resolving #then passes through without downgrade", () => {
    const tierConfig = {
      cheap: [],
      medium: [],
      expensive: ["sisyphus"],
    }

    const result = resolveModelPipeline(
      {
        intent: { uiSelectedModel: "anthropic/claude-opus-4-7" },
        constraints: { availableModels: new Set() },
      },
      { agentName: "sisyphus", modelTierConfig: tierConfig },
    )

    // Expensive agent keeps its expensive model
    expect(result).toBeDefined()
    expect(result?.model).toBe("anthropic/claude-opus-4-7")
    expect(result?.provenance).toBe("override")
  })

  it("#given no tier config #when resolving #then passes through to core pipeline unchanged", () => {
    const result = resolveModelPipeline(
      {
        intent: { uiSelectedModel: "anthropic/claude-opus-4-7" },
        constraints: { availableModels: new Set() },
      },
    )

    expect(result).toBeDefined()
    expect(result?.model).toBe("anthropic/claude-opus-4-7")
    expect(result?.provenance).toBe("override")
  })

  it("#given agent not in any tier #when resolving #then passes through without tier干预", () => {
    const tierConfig = {
      cheap: ["explore"],
      medium: [],
      expensive: ["sisyphus"],
    }

    const result = resolveModelPipeline(
      {
        intent: { uiSelectedModel: "anthropic/claude-opus-4-7" },
        constraints: { availableModels: new Set() },
      },
      { agentName: "oracle", modelTierConfig: tierConfig },
    )

    // Oracle is not in any tier, so no downgrade
    expect(result).toBeDefined()
    expect(result?.model).toBe("anthropic/claude-opus-4-7")
    expect(result?.provenance).toBe("override")
  })
})
