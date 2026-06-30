export interface PluginHooksConfig {
  name: string
  version: string
  hooks?: Record<string, unknown>
}

export type ClaudeHookEvent = string

export interface PluginConfig {
  disabledHooks?: boolean | string[]
}

export interface HookMatcher {
  matcher: string
}

export interface ClaudeHooksConfig {
  [eventName: string]: HookMatcher[]
}
