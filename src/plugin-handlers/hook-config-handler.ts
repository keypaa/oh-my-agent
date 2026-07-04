import type { PluginComponents } from "./plugin-components-loader"
import { log } from "../shared"

const _pluginHooksConfigs: Array<{ name: string; version: string; hooks?: Record<string, unknown> }> = []

function setPluginHooksConfigs(_cwd: string, configs: Array<{ name: string; version: string; hooks?: Record<string, unknown> }>): void {
  _pluginHooksConfigs.length = 0
  _pluginHooksConfigs.push(...configs)
}

export function applyHookConfig(params: {
  pluginComponents: PluginComponents;
}): void {
  const { pluginComponents } = params

  if (pluginComponents.hooksConfigs.length > 0) {
    log("[hook-config-handler] Merging plugin hooks configs", {
      count: pluginComponents.hooksConfigs.length,
      plugins: pluginComponents.plugins.map(p => p.name),
    })
  }

  setPluginHooksConfigs(process.cwd(), pluginComponents.hooksConfigs)
}
