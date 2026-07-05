import type { LoadedSkill } from "../opencode-skill-loader/types"
import type { BuiltinSkill } from "../builtin-skills/types"
import type { SkillCommand } from "./types"

function triggerToCommand(trigger: string): string {
  return trigger
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function skillNameToCommand(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s/+-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function collectTriggers(skill: LoadedSkill): string[] {
  const triggers = skill.triggers ?? []
  return triggers.filter((t) => t.length > 0)
}

function collectBuiltinTriggers(skill: BuiltinSkill): string[] {
  const raw = skill.triggers
  if (raw === undefined) return []
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    return trimmed.length > 0 ? [trimmed] : []
  }
  return raw.filter((t) => t.length > 0)
}

export function buildSkillCommands(skills: LoadedSkill[]): SkillCommand[] {
  const commands: SkillCommand[] = []

  for (const skill of skills) {
    const nameCommand = skillNameToCommand(skill.name)
    const triggers = collectTriggers(skill)

    commands.push({
      name: skill.name,
      description: skill.definition.description ?? "",
      triggers,
      command: nameCommand,
      skillPath: skill.resolvedPath,
    })
  }

  return commands
}

export function buildBuiltinSkillCommands(skills: BuiltinSkill[]): SkillCommand[] {
  const commands: SkillCommand[] = []

  for (const skill of skills) {
    const nameCommand = skillNameToCommand(skill.name)
    const triggers = collectBuiltinTriggers(skill)

    commands.push({
      name: skill.name,
      description: skill.description,
      triggers,
      command: nameCommand,
      skillPath: skill.resolvedPath,
    })
  }

  return commands
}

export function buildTriggerCommands(commands: SkillCommand[]): SkillCommand[] {
  const triggerCommands: SkillCommand[] = []

  for (const cmd of commands) {
    for (const trigger of cmd.triggers) {
      const triggerCommand = triggerToCommand(trigger)
      if (triggerCommand.length > 0 && triggerCommand !== cmd.command) {
        triggerCommands.push({
          name: `${cmd.name}/${trigger}`,
          description: `${cmd.description} (trigger: ${trigger})`,
          triggers: [],
          command: triggerCommand,
          skillPath: cmd.skillPath,
        })
      }
    }
  }

  return triggerCommands
}
