import {
  discoverInstalledPlugins,
  loadPluginCommands,
  loadPluginSkillsAsCommands,
} from "../features/claude-code-stubs"
import type { CommandDefinition } from "@oh-my-opencode/claude-code-compat-core/claude-code-command-loader/types"

export interface PluginCommandDiscoveryOptions {
  pluginsEnabled?: boolean
  enabledPluginsOverride?: Record<string, boolean>
}

export function discoverPluginCommandDefinitions(
  options?: PluginCommandDiscoveryOptions,
): Record<string, CommandDefinition> {
  if (options?.pluginsEnabled === false) {
    return {}
  }

  const { plugins } = discoverInstalledPlugins({
    enabledPluginsOverride: options?.enabledPluginsOverride,
  })

  return {
    ...loadPluginCommands(plugins) as Record<string, CommandDefinition>,
    ...loadPluginSkillsAsCommands(plugins) as Record<string, CommandDefinition>,
  }
}
