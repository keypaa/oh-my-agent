export interface SkillCommand {
  name: string
  description: string
  triggers: string[]
  command: string
  skillPath?: string
}

export interface SkillManifest {
  version: number
  generatedAt: string
  commands: SkillCommand[]
}
