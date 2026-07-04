import type { ModelFallbackInfo } from "../../features/task-toast-manager/types"
import type { DelegateTaskArgs } from "./types"
import type { ExecutorContext } from "./executor-types"
import type { FallbackEntry } from "../../shared/model-requirements"
import { mergeCategories } from "../../shared/merge-categories"
import { SISYPHUS_JUNIOR_AGENT } from "./sisyphus-junior-agent"
import { resolveCategoryConfig } from "./categories"
import { CATEGORY_PROMPT_APPEND_RESOLVERS } from "./constants"
import { parseModelString } from "../../shared/model-string-parser"
import { normalizeFallbackModels } from "../../shared/model-resolver"
import { buildFallbackChainFromModels } from "../../shared/fallback-chain-from-models"
import { CONFIG_BASENAME } from "../../shared/plugin-identity"
import { getAvailableModelsForDelegateTask } from "./available-models"
import type { DelegatedModelConfig } from "./types"
import { applyCategoryParams } from "./delegated-model-config"

function resolveCategoryPromptAppendForModel(
  categoryName: string,
  actualModel: string | undefined,
  staticPromptAppend: string,
  userPromptAppend: string | undefined,
): string | undefined {
  const dynamicResolver = CATEGORY_PROMPT_APPEND_RESOLVERS[categoryName]
  if (!dynamicResolver) {
    return staticPromptAppend || undefined
  }
  const dynamicBase = dynamicResolver(actualModel)
  if (!userPromptAppend) {
    return dynamicBase || undefined
  }
  return dynamicBase ? `${dynamicBase}\n\n${userPromptAppend}` : userPromptAppend
}

export interface CategoryResolutionResult {
  agentToUse: string
  categoryModel: DelegatedModelConfig | undefined
  categoryPromptAppend: string | undefined
  maxPromptTokens?: number
  modelInfo: ModelFallbackInfo | undefined
  actualModel: string | undefined
  isUnstableAgent: boolean
  fallbackChain?: FallbackEntry[]  // For runtime retry on model errors
  error?: string
}

function categoryResolutionError(error: string): CategoryResolutionResult {
  return {
    agentToUse: "",
    categoryModel: undefined,
    categoryPromptAppend: undefined,
    maxPromptTokens: undefined,
    modelInfo: undefined,
    actualModel: undefined,
    isUnstableAgent: false,
    error,
  }
}

export async function resolveCategoryExecution(
  args: DelegateTaskArgs,
  executorCtx: ExecutorContext,
  inheritedModel: string | undefined,
  systemDefaultModel: string | undefined
): Promise<CategoryResolutionResult> {
  const { client, userCategories, sisyphusJuniorModel } = executorCtx

  const categoryName = args.category!
  const enabledCategories = mergeCategories(userCategories)
  const categoryExists = enabledCategories[categoryName] !== undefined

  if (!categoryExists) {
    const allCategoryNames = Object.keys(enabledCategories).join(", ")
    return categoryResolutionError(`Unknown category: "${categoryName}". Available: ${allCategoryNames}`)
  }

  const availableModels = await getAvailableModelsForDelegateTask(client)

  const resolved = resolveCategoryConfig(categoryName, {
    userCategories,
    inheritedModel,
    systemDefaultModel,
    availableModels,
  })

  if (!resolved) {
    const allCategoryNames = Object.keys(enabledCategories).join(", ")
    return categoryResolutionError(`Unknown category: "${categoryName}". Available: ${allCategoryNames}`)
  }

  const normalizedConfiguredFallbackModels = normalizeFallbackModels(resolved.config.fallback_models)
  let actualModel: string | undefined
  let modelInfo: ModelFallbackInfo | undefined
  let categoryModel: DelegatedModelConfig | undefined

  const overrideModel = sisyphusJuniorModel
  const explicitCategoryModel = userCategories?.[args.category!]?.model

  // Precedence: explicit category model > sisyphus-junior default > category resolved model
  actualModel = explicitCategoryModel ?? overrideModel ?? resolved.model
  if (actualModel) {
    modelInfo = explicitCategoryModel || overrideModel
      ? { model: actualModel, type: "user-defined", source: "override" }
      : { model: actualModel, type: "system-default", source: "system-default" }
    const parsedModel = parseModelString(actualModel)
    const variantToUse = userCategories?.[args.category!]?.variant ?? resolved.config.variant
    categoryModel = parsedModel
      ? applyCategoryParams({ ...parsedModel, variant: variantToUse ?? parsedModel.variant }, resolved.config)
      : undefined
  }

  if (!categoryModel && actualModel) {
    const parsedModel = parseModelString(actualModel)
    categoryModel = parsedModel ?? undefined
  }
  const categoryPromptAppend = resolveCategoryPromptAppendForModel(
    args.category!,
    actualModel,
    resolved.promptAppend,
    userCategories?.[args.category!]?.prompt_append,
  )

  if (!categoryModel && !actualModel) {
    const categoryNames = Object.keys(enabledCategories)
    return categoryResolutionError(`Model not configured for category "${args.category}".

Configure in one of:
1. OpenCode: Set "model" in opencode.json
2. Oh-My-OpenCode: Set category model in ${CONFIG_BASENAME}.json
3. Provider: Connect a provider with available models

Current category: ${args.category}
Available categories: ${categoryNames.join(", ")}`)
  }

  const resolvedModel = actualModel?.toLowerCase()
  const isUnstableAgent = resolved.config.is_unstable_agent ?? (resolvedModel ? resolvedModel.includes("gemini") || resolvedModel.includes("minimax") : false)

  const defaultProviderID = categoryModel?.providerID
    ?? parseModelString(actualModel ?? "")?.providerID
    ?? "opencode"
  const configuredFallbackChain = buildFallbackChainFromModels(
    normalizedConfiguredFallbackModels,
    defaultProviderID,
  )

  return {
    agentToUse: SISYPHUS_JUNIOR_AGENT,
    categoryModel,
    categoryPromptAppend,
    maxPromptTokens: resolved.config.max_prompt_tokens,
    modelInfo,
    actualModel,
    isUnstableAgent,
    fallbackChain: configuredFallbackChain,
  }
}
