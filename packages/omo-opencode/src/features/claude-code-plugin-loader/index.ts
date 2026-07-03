import type { PluginComponents } from "../../plugin-handlers/plugin-components-loader";

export function loadAllPluginComponents(_options?: {
  enabledPluginsOverride?: Record<string, boolean>
  anthropicProvider?: string
}): Promise<PluginComponents> {
  return Promise.resolve({
    commands: {},
    skills: {},
    agents: {},
    mcpServers: {},
    hooksConfigs: [],
    plugins: [],
    errors: [],
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
