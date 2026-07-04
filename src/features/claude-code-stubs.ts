export interface McpServerDefinition {
  name: string
}

export function getSystemMcpServerNames(): string[] {
  return []
}

export function loadMcpConfigs(): McpServerDefinition[] {
  return []
}

export function setAdditionalAllowedMcpEnvVars(_vars: string[]): void {}

export interface CommandDefinition {
  name?: string
  description?: string
  argumentHint?: string
  template: string
  model?: string
  agent?: string
  subtask?: boolean
}

export interface CommandFrontmatter {
  description?: string
  "argument-hint"?: string
  model?: string
  agent?: string
  subtask?: boolean
}

export async function loadUserCommands(): Promise<CommandDefinition[]> {
  return []
}

export async function loadProjectCommands(): Promise<CommandDefinition[]> {
  return []
}

export async function loadOpencodeGlobalCommands(): Promise<CommandDefinition[]> {
  return []
}

export async function loadOpencodeProjectCommands(): Promise<CommandDefinition[]> {
  return []
}

export function clearCommandLoaderCache(): void {}

export async function loadProjectAgents(): Promise<Record<string, unknown>> {
  return {}
}

export async function loadUserAgents(): Promise<Record<string, unknown>> {
  return {}
}

export async function loadAgentDefinitions(): Promise<Array<unknown>> {
  return []
}

export async function loadOpencodeGlobalAgents(): Promise<Record<string, unknown>> {
  return {}
}

export async function loadOpencodeProjectAgents(): Promise<Record<string, unknown>> {
  return {}
}

export async function readOpencodeConfigAgents(): Promise<Record<string, unknown>> {
  return {}
}

export interface PluginHooksConfig {
  name: string
  version: string
  hooks?: Record<string, unknown>
}

export type PluginComponents = {
  commands: Record<string, unknown>
  skills: Record<string, unknown>
  agents: Record<string, unknown>
  mcpServers: Record<string, unknown>
  hooksConfigs: PluginHooksConfig[]
  plugins: Array<{ name: string; version: string }>
  errors: Array<{ pluginKey: string; installPath: string; error: string }>
}

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
