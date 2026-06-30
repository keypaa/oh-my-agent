import type { PluginComponentsLoadResult } from "../opencode-plugin-loader/types"

export function loadAllPluginComponents(_options?: {
  enabledPluginsOverride?: Record<string, boolean>
  anthropicProvider?: string
}): Promise<PluginComponentsLoadResult> {
  return Promise.resolve({
    tools: [],
    commands: [],
    mcpServers: [],
    hooks: [],
    agents: [],
    skills: [],
    mcpConfig: null,
  })
}

export function discoverInstalledPlugins(_options?: {
  enabledPluginsOverride?: Record<string, boolean>
}): { plugins: Array<{ name: string; path: string }>; errors: Array<{ name: string; error: string }> } {
  return { plugins: [], errors: [] }
}

export function loadPluginCommands(_plugins: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {}
}

export function loadPluginSkillsAsCommands(_plugins: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {}
}
