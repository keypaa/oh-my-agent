export type CommandScope = "user" | "project" | "opencode" | "opencode-project"

export interface HandoffDefinition {
  label: string
  agent: string
  prompt: string
  send?: boolean
}

export interface CommandDefinition {
  name: string
  description?: string
  template: string
  agent?: string
  model?: string
  subtask?: boolean
  argumentHint?: string
  handoffs?: HandoffDefinition[]
}

export interface CommandFrontmatter {
  description?: string
  "argument-hint"?: string
  agent?: string
  model?: string
  subtask?: boolean
  handoffs?: HandoffDefinition[]
}

export interface LoadedCommand {
  name: string
  path: string
  definition: CommandDefinition
  scope: CommandScope
}
