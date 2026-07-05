import type { ToolDefinition } from "@opencode-ai/plugin"
import type { AvailableCategory } from "../agents/dynamic-agent-prompt-builder"
import type { OhMyOpenCodeConfig } from "../config"
import type { Managers } from "../create-managers"
import type { SkillContext } from "./skill-context"
import type { PluginContext, ToolsRecord } from "./types"
import type { ToolRegistryFactories } from "./tool-registry-factories"

import { getMainSessionID } from "../features/session-state"
import { log } from "../shared"
import { getSisyphusJuniorModelOverride } from "./tool-registry-team-tools"
import { createNativeSkills, getPluginInputNativeSkills } from "./native-skills"
import { createSkillContext } from "./skill-context"
import { createRuntimeSkillsResolver, readRuntimeHostSkills } from "./runtime-skill-resolver"

export function createCoreTools(args: {
  readonly ctx: PluginContext
  readonly pluginConfig: OhMyOpenCodeConfig
  readonly managers: Pick<Managers, "backgroundManager" | "skillMcpManager" | "modelFallbackControllerAccessor">
  readonly skillContext: SkillContext
  readonly availableCategories: AvailableCategory[]
  readonly factories: ToolRegistryFactories
}): Record<string, ToolDefinition> {
  const { ctx, pluginConfig, managers, skillContext, availableCategories, factories } = args
  const backgroundTools = factories.createBackgroundTools(managers.backgroundManager, ctx.client)
  const callOmoAgent = factories.createCallOmoAgent(
    ctx,
    managers.backgroundManager,
    pluginConfig.disabled_agents ?? [],
    pluginConfig.agents,
    pluginConfig.categories,
    managers.modelFallbackControllerAccessor,
  )
  const isMultimodalLookerEnabled = !(pluginConfig.disabled_agents ?? []).some(
    (agent) => agent.toLowerCase() === "multimodal-looker",
  )
  const nativeSkills = getPluginInputNativeSkills(ctx) ?? createNativeSkills({
    client: ctx.client,
    directory: ctx.directory,
  })
  const getSessionIDForMcp = (): string | undefined => getMainSessionID()
  const getLoadedSkills = createRuntimeSkillsResolver({
    baseSkills: skillContext.mergedSkills,
    readRuntimeHostSkills: () => readRuntimeHostSkills(ctx.client),
    buildMergedSkills: async (hostSkills) =>
      (await createSkillContext({ directory: ctx.directory, pluginConfig, hostSkills })).mergedSkills,
  })
  const delegateTask = factories.createDelegateTask({
    manager: managers.backgroundManager,
    client: ctx.client,
    directory: ctx.directory,
    userCategories: pluginConfig.categories,
    agentOverrides: pluginConfig.agents,
    gitMasterConfig: pluginConfig.git_master,
    sisyphusJuniorModel: getSisyphusJuniorModelOverride(pluginConfig.agents?.["sisyphus-junior"]),
    browserProvider: skillContext.browserProvider,
    disabledSkills: skillContext.disabledSkills,
    teamModeEnabled: pluginConfig.team_mode?.enabled ?? false,
    availableCategories,
    availableSkills: skillContext.availableSkills,
    nativeSkills,
    getLoadedSkills,
    sisyphusAgentConfig: pluginConfig.sisyphus_agent,
    syncPollTimeoutMs: pluginConfig.background_task?.syncPollTimeoutMs,
    modelFallbackControllerAccessor: managers.modelFallbackControllerAccessor,
    onSyncSessionCreated: async (event) => {
      log("[index] onSyncSessionCreated callback", {
        sessionID: event.sessionID,
        parentID: event.parentID,
        title: event.title,
      })

    },
  })

  const skillMcpTool = factories.createSkillMcpTool({
    manager: managers.skillMcpManager,
    getLoadedSkills,
    getSessionID: getSessionIDForMcp,
    provenanceGuardConfig: pluginConfig.provenance_guard,
  })
  const commands = factories.discoverCommandsSync(ctx.directory)
  const skillTool = factories.createSkillTool({
    directory: ctx.directory,
    commands,
    skills: skillContext.mergedSkills,
    getLoadedSkills,
    mcpManager: managers.skillMcpManager,
    getSessionID: getSessionIDForMcp,
    gitMasterConfig: pluginConfig.git_master,
    browserProvider: skillContext.browserProvider,
    disabledSkills: skillContext.disabledSkills,
    teamModeEnabled: pluginConfig.team_mode?.enabled ?? false,
    nativeSkills,

    includeSkillsInDescription: true,
  })

  const tools: ToolsRecord = {
    ...factories.createGrepTools(ctx),
    ...factories.createGlobTools(ctx),
    ...factories.createSessionManagerTools(ctx),
    ...backgroundTools,
    call_omo_agent: callOmoAgent,
  }
  if (isMultimodalLookerEnabled) {
    tools.look_at = factories.createLookAt(ctx)
  }
  tools.task = delegateTask
  tools.skill_mcp = skillMcpTool
  tools.skill = skillTool

  return tools
}
