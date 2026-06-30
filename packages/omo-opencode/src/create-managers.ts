import type { OhMyOpenCodeConfig } from "./config"
import type { ModelCacheState } from "./plugin-state"
import type { PluginContext } from "./plugin/types"

import type { SubagentSessionCreatedEvent } from "./features/background-agent"
import { BackgroundManager } from "./features/background-agent"
import { SkillMcpManager } from "./features/skill-mcp-manager"
import { cleanupSessionTeamRuns } from "./features/team-mode/team-runtime/session-cleanup"
import { createModelFallbackControllerAccessor } from "./hooks/model-fallback"
import { initTaskToastManager } from "./features/task-toast-manager"
import { registerManagerForCleanup } from "./features/background-agent/process-cleanup"
import { createConfigHandler } from "./plugin-handlers"
import { log } from "./shared"
import type { ModelFallbackControllerAccessor } from "./hooks/model-fallback"

type CreateManagersDeps = {
  BackgroundManagerClass: typeof BackgroundManager
  SkillMcpManagerClass: typeof SkillMcpManager
  initTaskToastManagerFn: typeof initTaskToastManager
  registerManagerForCleanupFn: typeof registerManagerForCleanup
  cleanupSessionTeamRunsFn: typeof cleanupSessionTeamRuns
  createConfigHandlerFn: typeof createConfigHandler
}

const defaultCreateManagersDeps: CreateManagersDeps = {
  BackgroundManagerClass: BackgroundManager,
  SkillMcpManagerClass: SkillMcpManager,
  initTaskToastManagerFn: initTaskToastManager,
  registerManagerForCleanupFn: registerManagerForCleanup,
  cleanupSessionTeamRunsFn: cleanupSessionTeamRuns,
  createConfigHandlerFn: createConfigHandler,
}

export type Managers = {
  backgroundManager: BackgroundManager
  skillMcpManager: SkillMcpManager
  configHandler: ReturnType<typeof createConfigHandler>
  modelFallbackControllerAccessor: ModelFallbackControllerAccessor
}

export function createManagers(args: {
  ctx: PluginContext
  pluginConfig: OhMyOpenCodeConfig
  modelCacheState: ModelCacheState
  backgroundNotificationHookEnabled: boolean
  runtimeSkillSourceUrl?: string
  deps?: Partial<CreateManagersDeps>
}): Managers {
  const { ctx, pluginConfig, modelCacheState, backgroundNotificationHookEnabled, runtimeSkillSourceUrl } = args
  const deps = { ...defaultCreateManagersDeps, ...args.deps }

  const modelFallbackControllerAccessor = createModelFallbackControllerAccessor()
  let backgroundManager: BackgroundManager | undefined

  const cleanupTeamModeRuns = async (): Promise<void> => {
    if (!pluginConfig.team_mode?.enabled) return
    const report = await deps.cleanupSessionTeamRunsFn({
      config: pluginConfig.team_mode,
      bgMgr: backgroundManager,
    })
    if (report.cleanedTeamRunIds.length > 0 || report.errors.length > 0) {
      log("[create-managers] team-mode session cleanup complete", report)
    }
  }

  deps.registerManagerForCleanupFn({
    shutdown: async () => {
      await cleanupTeamModeRuns().catch((error) => {
        log("[create-managers] team-mode cleanup error during process shutdown:", error)
      })
    },
  })

  backgroundManager = new deps.BackgroundManagerClass({
    pluginContext: ctx,
    config: pluginConfig.background_task,
    onSubagentSessionCreated: async (event: SubagentSessionCreatedEvent) => {
        log("[create-managers] onSubagentSessionCreated callback received", {
          sessionID: event.sessionID,
          parentID: event.parentID,
          title: event.title,
        })
        log("[create-managers] onSubagentSessionCreated callback completed")
    },
    onSubagentSessionDeleted: async (event: { sessionID: string }) => {
      log("[create-managers] onSubagentSessionDeleted callback received", {
        sessionID: event.sessionID,
      })
    },
    onShutdown: async () => {
      await cleanupTeamModeRuns().catch((error) => {
        log("[create-managers] team-mode cleanup error during shutdown:", error)
      })
    },
    enableParentSessionNotifications: backgroundNotificationHookEnabled,
    modelFallbackControllerAccessor,
  })

  deps.initTaskToastManagerFn(ctx.client)

  const skillMcpManager = new deps.SkillMcpManagerClass()

  const configHandler = deps.createConfigHandlerFn({
    ctx: { directory: ctx.directory, client: ctx.client },
    pluginConfig,
    modelCacheState,
    runtimeSkillSourceUrl,
  })

  return {
    backgroundManager,
    skillMcpManager,
    configHandler,
    modelFallbackControllerAccessor,
  }
}
