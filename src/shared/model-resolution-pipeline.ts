import {
  _setModelResolutionLogImplementationForTesting,
  resolveModelPipeline as resolveModelPipelineFromCore,
} from "#shared/model-core"
import type {
  PipelineModelResolutionRequest,
  PipelineModelResolutionResult,
} from "#shared/model-core"
import * as connectedProvidersCache from "./connected-providers-cache"
import { log } from "./logger"

export { _setModelResolutionLogImplementationForTesting }

type ModelTierConfig = {
  cheap: string[]
  medium: string[]
  expensive: string[]
}

function getAgentTier(agentName: string, tierConfig: ModelTierConfig): string | undefined {
  if (tierConfig.cheap.includes(agentName)) return "cheap"
  if (tierConfig.medium.includes(agentName)) return "medium"
  if (tierConfig.expensive.includes(agentName)) return "expensive"
  return undefined
}

export function resolveModelPipeline(
  request: PipelineModelResolutionRequest,
  options?: { agentName?: string; modelTierConfig?: ModelTierConfig },
): PipelineModelResolutionResult | undefined {
  if (options?.agentName && options?.modelTierConfig) {
    const agentTier = getAgentTier(options.agentName, options.modelTierConfig)
    if (agentTier === "cheap") {
      const hasCallerOverride = !!(request.intent?.uiSelectedModel || request.intent?.userModel)
      if (hasCallerOverride) {
        log("[model-resolution-pipeline] Downgrading model for cheap-tier agent", {
          agent: options.agentName,
          callerModel: request.intent?.uiSelectedModel ?? request.intent?.userModel,
        })
        const modifiedRequest: PipelineModelResolutionRequest = {
          ...request,
          intent: {
            ...request.intent,
            uiSelectedModel: undefined,
            userModel: undefined,
          },
        }
        return resolveModelPipelineFromCore(modifiedRequest, connectedProvidersCache)
      }
    }
  }

  return resolveModelPipelineFromCore(request, connectedProvidersCache)
}

export type {
  PipelineModelResolutionRequest as ModelResolutionRequest,
  PipelineModelResolutionProvenance as ModelResolutionProvenance,
  PipelineModelResolutionResult as ModelResolutionResult,
} from "#shared/model-core"
