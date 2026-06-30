import type { McpServerDefinition } from "@opencode-ai/plugin"

export function getSystemMcpServerNames(): string[] {
  return []
}

export function loadMcpConfigs(): McpServerDefinition[] {
  return []
}

export function setAdditionalAllowedMcpEnvVars(_vars: string[]): void {}

export { type McpServerDefinition }
