const { beforeEach, describe, expect, mock, test } = require("bun:test")
import { tool } from "@opencode-ai/plugin"

import { OhMyOpenCodeConfigSchema, type OhMyOpenCodeConfig } from "../config"

import type { ToolsRecord } from "./types"

const fakeTool = tool({
  description: "test tool",
  args: {},
  async execute(): Promise<string> {
    return "ok"
  },
})

const delegateTaskTool = tool({
  description: "task tool",
  args: {},
  async execute(): Promise<string> {
    return "ok"
  },
})

const syncSessionCreatedCallbacks: Array<
  ((event: { sessionID: string; parentID: string; title: string }) => Promise<void>) | undefined
> = []

const TEAM_TOOL_NAMES = [
  "team_create",
  "team_delete",
  "team_shutdown_request",
  "team_approve_shutdown",
  "team_reject_shutdown",
  "team_send_message",
  "team_task_create",
  "team_task_list",
  "team_task_update",
  "team_task_get",
  "team_status",
  "team_list",
] as const

const { createToolRegistry, trimToolsToCap } = await import("./tool-registry")

const toolFactories: NonNullable<Parameters<typeof createToolRegistry>[0]["toolFactories"]> = {
  createBackgroundTools: mock(() => ({})),
  createCallOmoAgent: mock(() => fakeTool),
  createLookAt: mock(() => fakeTool),
  createSkillMcpTool: mock(() => fakeTool),
  createSkillTool: mock(() => fakeTool),
  createGrepTools: mock(() => ({})),
  createGlobTools: mock(() => ({})),
  createSessionManagerTools: mock(() => ({})),
  createDelegateTask: mock((options: { onSyncSessionCreated?: typeof syncSessionCreatedCallbacks[number] }) => {
    syncSessionCreatedCallbacks.push(options.onSyncSessionCreated)
    return delegateTaskTool
  }),
  discoverCommandsSync: mock(() => []),
  interactive_bash: fakeTool,
  createTaskCreateTool: mock(() => fakeTool),
  createTaskGetTool: mock(() => fakeTool),
  createTaskList: mock(() => fakeTool),
  createTaskUpdateTool: mock(() => fakeTool),
  createHashlineEditTool: mock(() => fakeTool),
  createTeamApproveShutdownTool: mock(() => fakeTool),
  createTeamCreateTool: mock(() => fakeTool),
  createTeamDeleteTool: mock(() => fakeTool),
  createTeamRejectShutdownTool: mock(() => fakeTool),
  createTeamShutdownRequestTool: mock(() => fakeTool),
  createTeamSendMessageTool: mock(() => fakeTool),
  createTeamTaskCreateTool: mock(() => fakeTool),
  createTeamTaskGetTool: mock(() => fakeTool),
  createTeamTaskListTool: mock(() => fakeTool),
  createTeamTaskUpdateTool: mock(() => fakeTool),
  createTeamStatusTool: mock(() => fakeTool),
  createTeamListTool: mock(() => fakeTool),
}

type PluginConfigOverrides = Omit<Partial<OhMyOpenCodeConfig>, "team_mode"> & {
  team_mode?: Partial<NonNullable<OhMyOpenCodeConfig["team_mode"]>>
}

function createPluginConfig(overrides: PluginConfigOverrides = {}): OhMyOpenCodeConfig {
  return OhMyOpenCodeConfigSchema.parse({
    git_master: {
      commit_footer: false,
      include_co_authored_by: false,
      git_env_prefix: "",
    },
    ...overrides,
  })
}

beforeEach(() => {
  syncSessionCreatedCallbacks.length = 0
})

describe("#given tool trimming prioritization", () => {
  test("#when max_tools trims a hashline edit registration named edit #then edit is removed before higher-priority tools", () => {
    const filteredTools = {
      bash: fakeTool,
      edit: fakeTool,
      read: fakeTool,
    } satisfies ToolsRecord

    trimToolsToCap(filteredTools, 2)

    expect(filteredTools).not.toHaveProperty("edit")
    expect(filteredTools).toHaveProperty("bash")
    expect(filteredTools).toHaveProperty("read")
  })
})

describe("#given task_system configuration", () => {
  test("#when task_system is omitted #then task tools are not registered by default", () => {
    syncSessionCreatedCallbacks.length = 0

    const result = createToolRegistry({
      ctx: { directory: "/tmp" } as Parameters<typeof createToolRegistry>[0]["ctx"],
      pluginConfig: createPluginConfig(),
      managers: {
        backgroundManager: {},
        skillMcpManager: {},
      } as Parameters<typeof createToolRegistry>[0]["managers"],
      skillContext: {
        mergedSkills: [],
        availableSkills: [],
        browserProvider: "playwright",
        disabledSkills: new Set(),
      },
      availableCategories: [],
      toolFactories,
    })

    expect(result.taskSystemEnabled).toBe(false)
    expect(result.filteredTools).not.toHaveProperty("task_create")
    expect(result.filteredTools).not.toHaveProperty("task_get")
    expect(result.filteredTools).not.toHaveProperty("task_list")
    expect(result.filteredTools).not.toHaveProperty("task_update")
  })

  test("#when task_system is enabled #then task tools are registered", () => {
    syncSessionCreatedCallbacks.length = 0

    const result = createToolRegistry({
      ctx: { directory: "/tmp" } as Parameters<typeof createToolRegistry>[0]["ctx"],
      pluginConfig: createPluginConfig({
        experimental: { task_system: true },
      }),
      managers: {
        backgroundManager: {},
        skillMcpManager: {},
      } as Parameters<typeof createToolRegistry>[0]["managers"],
      skillContext: {
        mergedSkills: [],
        availableSkills: [],
        browserProvider: "playwright",
        disabledSkills: new Set(),
      },
      availableCategories: [],
      toolFactories,
    })

    expect(result.taskSystemEnabled).toBe(true)
    expect(result.filteredTools).toHaveProperty("task_create")
    expect(result.filteredTools).toHaveProperty("task_get")
    expect(result.filteredTools).toHaveProperty("task_list")
    expect(result.filteredTools).toHaveProperty("task_update")
  })
})

describe("#given the OMO skill tool overrides OpenCode native skill discovery", () => {
  test("#when the registry creates the skill tool #then plugin skills are advertised in the description", () => {
    const createSkillToolCallsBefore = toolFactories.createSkillTool.mock.calls.length

    createToolRegistry({
      ctx: { directory: "/tmp" } as Parameters<typeof createToolRegistry>[0]["ctx"],
      pluginConfig: createPluginConfig(),
      managers: {
        backgroundManager: {},
        skillMcpManager: {},
      } as Parameters<typeof createToolRegistry>[0]["managers"],
      skillContext: {
        mergedSkills: [
          {
            name: "security-review",
            path: "<builtin>/security-review/SKILL.md",
            definition: {
              name: "security-review",
              description: "Security review instructions",
              template: "review",
            },
            scope: "builtin",
          },
        ],
        availableSkills: [],
        browserProvider: "playwright",
        disabledSkills: new Set(),
      },
      availableCategories: [],
      toolFactories,
    })

    const skillToolOptions = toolFactories.createSkillTool.mock.calls[createSkillToolCallsBefore]?.[0]

    expect(skillToolOptions).toMatchObject({
      includeSkillsInDescription: true,
      skills: [
        {
          name: "security-review",
          definition: {
            name: "security-review",
          },
        },
      ],
    })
  })
})

describe("#given team_mode configuration", () => {
  test("#when team_mode is enabled #then all 12 team tools are registered", () => {
    syncSessionCreatedCallbacks.length = 0

    const result = createToolRegistry({
      ctx: { directory: "/tmp" } as Parameters<typeof createToolRegistry>[0]["ctx"],
      pluginConfig: createPluginConfig({
        team_mode: {
          enabled: true,
        },
      }),
      managers: {
        backgroundManager: {},
        skillMcpManager: {},
      } as Parameters<typeof createToolRegistry>[0]["managers"],
      skillContext: {
        mergedSkills: [],
        availableSkills: [],
        browserProvider: "playwright",
        disabledSkills: new Set(),
      },
      availableCategories: [],
      toolFactories,
    })

    for (const teamToolName of TEAM_TOOL_NAMES) {
      expect(result.filteredTools).toHaveProperty(teamToolName)
    }
  })

  test("#when team_mode is disabled #then zero team tools are registered", () => {
    syncSessionCreatedCallbacks.length = 0

    const result = createToolRegistry({
      ctx: { directory: "/tmp" } as Parameters<typeof createToolRegistry>[0]["ctx"],
      pluginConfig: createPluginConfig({
        team_mode: {
          enabled: false,
        },
      }),
      managers: {
        backgroundManager: {},
        skillMcpManager: {},
      } as Parameters<typeof createToolRegistry>[0]["managers"],
      skillContext: {
        mergedSkills: [],
        availableSkills: [],
        browserProvider: "playwright",
        disabledSkills: new Set(),
      },
      availableCategories: [],
      toolFactories,
    })

    const registeredTeamToolNames = Object.keys(result.filteredTools).filter((toolName) => toolName.startsWith("team_"))

    expect(registeredTeamToolNames).toHaveLength(0)
  })
})


