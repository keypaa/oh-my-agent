export interface PluginConfig {
  disabledHooks?: boolean | string[]
}

export function isHookDisabled(
  config: PluginConfig,
  hookType: string
): boolean {
  const { disabledHooks } = config

  if (disabledHooks === undefined) {
    return false
  }

  if (disabledHooks === true) {
    return true
  }

  if (Array.isArray(disabledHooks)) {
    return disabledHooks.includes(hookType)
  }

  return false
}
