import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import type { AvailableAgent, AvailableCategory, AvailableSkill } from "../dynamic-agent-prompt-builder"
import { isAnyProviderConnected } from "../../shared"
import { log } from "../../shared/logger"
import { createHephaestusAgent, isHephaestusSupportedModel } from "../hephaestus"
import { applyEnvironmentContext } from "./environment-context"
import { applyCategoryOverride, mergeAgentConfig } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"
import { applyFrontierToolSchemaPermission } from "../frontier-tool-schema-guard"

export function maybeCreateHephaestusConfig(input: {
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  availableModels: Set<string>
  systemDefaultModel?: string
  isFirstRunNoCache: boolean
  availableAgents: AvailableAgent[]
  availableSkills: AvailableSkill[]
  availableCategories: AvailableCategory[]
  mergedCategories: Record<string, CategoryConfig>
  directory?: string
  useTaskSystem: boolean
  disableOmoEnv?: boolean
}): AgentConfig | undefined {
  const {
    disabledAgents,
    agentOverrides,
    availableModels,
    systemDefaultModel,
    isFirstRunNoCache,
    availableAgents,
    availableSkills,
    availableCategories,
    mergedCategories,
    directory,
    useTaskSystem,
    disableOmoEnv = false,
  } = input

  if (disabledAgents.includes("hephaestus")) return undefined

  const hephaestusOverride = agentOverrides["hephaestus"]
  const hasHephaestusExplicitConfig = hephaestusOverride !== undefined

  // Hephaestus requires an OpenAI-compatible provider (GPT models only).
  // With empty requirements, provider gating is checked directly.
  const HEPHAESTUS_REQUIRED_PROVIDERS = ["openai", "github-copilot", "opencode", "vercel"]
  const hasRequiredProvider =
    hasHephaestusExplicitConfig ||
    isFirstRunNoCache ||
    isAnyProviderConnected(HEPHAESTUS_REQUIRED_PROVIDERS, availableModels)

  if (!hasRequiredProvider) {
    log("[agent-registration] Agent skipped: required provider not connected", {
      agent: "hephaestus",
      requiredProvider: HEPHAESTUS_REQUIRED_PROVIDERS,
    })
    return undefined
  }

  let hephaestusResolution = applyModelResolution({
    userModel: hephaestusOverride?.model,
    requirement: undefined,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !hephaestusOverride?.model && !hephaestusResolution) {
    hephaestusResolution = getFirstFallbackModel(undefined)
  }

  if (!hephaestusResolution) {
    log("[agent-registration] Agent skipped: model resolution returned no result", {
      agent: "hephaestus",
      configuredModel: hephaestusOverride?.model,
    })
    return undefined
  }
  let hephaestusModel = hephaestusResolution.model
  let hephaestusResolvedVariant = hephaestusResolution.variant

  if (!isHephaestusSupportedModel(hephaestusModel)) {
    // With empty requirements, the system default may not be supported.
    // Try to find a supported model from available models.
    const fallbackModel = [...availableModels].find((m) => {
      const parts = m.split("/")
      return parts.length >= 2 && isHephaestusSupportedModel(parts.slice(1).join("/"))
    })
    if (fallbackModel) {
      hephaestusModel = fallbackModel
      hephaestusResolvedVariant = undefined
      log("[agent-registration] Hephaestus using fallback model from available models", {
        model: fallbackModel,
      })
    } else {
      log("[agent-registration] Agent skipped: unsupported Hephaestus model", {
        agent: "hephaestus",
        configuredModel: hephaestusModel,
      })
      return undefined
    }
  }

  let hephaestusConfig = createHephaestusAgent(
    hephaestusModel,
    availableAgents,
    undefined,
    availableSkills,
    availableCategories,
    useTaskSystem
  )

  hephaestusConfig = { ...hephaestusConfig, variant: hephaestusResolvedVariant ?? "medium" }

  const hepOverrideCategory = (hephaestusOverride as Record<string, unknown> | undefined)?.category as string | undefined
  if (hepOverrideCategory) {
    hephaestusConfig = applyCategoryOverride(hephaestusConfig, hepOverrideCategory, mergedCategories)
    if (!isHephaestusSupportedModel(hephaestusConfig.model)) {
      log("[agent-registration] Agent skipped: unsupported Hephaestus category model", {
        agent: "hephaestus",
        configuredModel: hephaestusConfig.model,
      })
      return undefined
    }
  }

  hephaestusConfig = applyEnvironmentContext(hephaestusConfig, directory, { disableOmoEnv })

  if (hephaestusOverride) {
    hephaestusConfig = mergeAgentConfig(hephaestusConfig, hephaestusOverride, directory)
    if (!isHephaestusSupportedModel(hephaestusConfig.model)) {
      log("[agent-registration] Agent skipped: unsupported Hephaestus override model", {
        agent: "hephaestus",
        configuredModel: hephaestusConfig.model,
      })
      return undefined
    }
  }

  const resolvedModel = hephaestusConfig.model ?? ""
  hephaestusConfig.permission = applyFrontierToolSchemaPermission(
    hephaestusConfig.permission,
    resolvedModel,
    hephaestusOverride?.permission,
    (hephaestusOverride as { tools?: Record<string, boolean> } | undefined)?.tools
  )

  return hephaestusConfig
}
