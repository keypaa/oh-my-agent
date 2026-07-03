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
