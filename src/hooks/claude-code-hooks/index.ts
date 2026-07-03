import type { PluginHooksConfig } from "./types"

export function createClaudeCodeHooksHook(): (pluginHooksConfigs: PluginHooksConfig[]) => Record<string, unknown>[] {
  return () => []
}
