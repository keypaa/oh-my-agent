/// <reference types="bun-types" />

import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"

import { OhMyOpenCodeConfigSchema } from "./config/schema/oh-my-opencode-config"
import { createManagers } from "./create-managers"
import { createModelCacheState } from "./plugin-state"

type CleanupRegistration = {
  shutdown: () => void | Promise<void>
}

let backgroundManagerOptions: {
  onSubagentSessionCreated?: (event: { sessionID: string; parentID: string; title: string }) => Promise<void>
  onShutdown?: () => void | Promise<void>
} | null = null
const registeredCleanupManagers: CleanupRegistration[] = []

class MockBackgroundManager {
  constructor(config: {
    onSubagentSessionCreated?: (event: { sessionID: string; parentID: string; title: string }) => Promise<void>
    onShutdown?: () => void | Promise<void>
  }) {
    backgroundManagerOptions = config
  }

  async shutdown(): Promise<void> {
    await backgroundManagerOptions?.onShutdown?.()
  }
}

class MockSkillMcpManager {
  constructor(..._args: unknown[]) {}
}

function createConfigHandler(): ReturnType<typeof import("./plugin-handlers").createConfigHandler> {
  return async () => {}
}

function initTaskToastManager(): ReturnType<typeof import("./features/task-toast-manager").initTaskToastManager> {
  return {} as ReturnType<typeof import("./features/task-toast-manager").initTaskToastManager>
}

function registerManagerForCleanup(manager: CleanupRegistration): void {
  registeredCleanupManagers.push(manager)
}

function createDeps(): NonNullable<Parameters<typeof createManagers>[0]["deps"]> {
  return {
    BackgroundManagerClass: MockBackgroundManager as typeof import("./features/background-agent").BackgroundManager,
    SkillMcpManagerClass: MockSkillMcpManager as typeof import("./features/skill-mcp-manager").SkillMcpManager,
    initTaskToastManagerFn: initTaskToastManager,
    registerManagerForCleanupFn: registerManagerForCleanup,
    cleanupSessionTeamRunsFn: (async () => ({
      cleanedTeamRunIds: [],
      removedLayoutTeamRunIds: [],
      errors: [],
    })) as unknown as typeof import("./features/team-mode/team-runtime/session-cleanup").cleanupSessionTeamRuns,
    createConfigHandlerFn: createConfigHandler,
  }
}

function createContext(directory: string): PluginInput {
  const shell = Object.assign(
    () => {
      throw new Error("shell should not be called in this test")
    },
    {
      braces: () => [],
      escape: (input: string) => input,
      env() {
        return shell
      },
      cwd() {
        return shell
      },
      nothrow() {
        return shell
      },
      throws() {
        return shell
      },
    },
  )

  return {
    project: {
      id: "project-id",
      worktree: directory,
      time: { created: Date.now() },
    },
    directory,
    worktree: directory,
    experimental_workspace: { register: () => {} },
    serverUrl: new URL("http://localhost:4096"),
    $: shell,
    client: {} as PluginInput["client"],
  }
}

describe("createManagers", () => {
  beforeEach(() => {
    backgroundManagerOptions = null
    registeredCleanupManagers.length = 0
  })

  it("#given default config #when managers are created #then it returns background and skill mcp managers", () => {
    const args = {
      ctx: createContext("/tmp"),
      pluginConfig: OhMyOpenCodeConfigSchema.parse({}),
      modelCacheState: createModelCacheState(),
      backgroundNotificationHookEnabled: false,
      deps: createDeps(),
    }

    const managers = createManagers(args)

    expect(managers.backgroundManager).toBeDefined()
    expect(managers.skillMcpManager).toBeDefined()
    expect(managers.configHandler).toBeDefined()
    expect(managers.modelFallbackControllerAccessor).toBeDefined()
    expect(managers.tmuxSessionManager).toBeUndefined()
  })

  it("#given team mode shutdown runs #when process cleanup runs #then session team runs are cleaned", async () => {
    const args = {
      ctx: createContext("/tmp/project"),
      pluginConfig: OhMyOpenCodeConfigSchema.parse({
        team_mode: {
          enabled: true,
        },
      }),
      modelCacheState: createModelCacheState(),
      backgroundNotificationHookEnabled: false,
      deps: createDeps(),
    }

    createManagers(args)

    await registeredCleanupManagers[0]?.shutdown()
  })
})
