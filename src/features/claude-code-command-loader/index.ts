export interface CommandDefinition {
  name?: string
  description?: string
  argumentHint?: string
  template: string
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
