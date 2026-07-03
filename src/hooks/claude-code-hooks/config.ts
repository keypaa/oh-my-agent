import type { PluginHooksConfig } from "./types"

const _pluginHooksConfigs: PluginHooksConfig[] = []

export function setPluginHooksConfigs(_cwd: string, configs: PluginHooksConfig[]): void {
  _pluginHooksConfigs.length = 0
  _pluginHooksConfigs.push(...configs)
}
