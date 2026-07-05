import type { AvailableSkill } from "../../agents/dynamic-agent-prompt-builder"
import { buildSkillCommands, buildTriggerCommands } from "../../features/skill-command-registrar"

function formatSkillNames(skills: AvailableSkill[], limit: number): string {
  if (skills.length === 0) return "(none)"
  const shown = skills.slice(0, limit).map((s) => s.name)
  const remaining = skills.length - shown.length
  const suffix = remaining > 0 ? ` (+${remaining} more)` : ""
  return shown.join(", ") + suffix
}

function buildCommandLines(skills: AvailableSkill[]): string[] {
  const skillCommands = skills
    .filter((s) => s.triggers && s.triggers.length > 0)
    .map((s) => ({
      name: s.name,
      description: s.description,
      triggers: s.triggers!,
      command: s.name.toLowerCase().replace(/[^a-z0-9\s/+-]/g, "").replace(/\s+/g, "-"),
      skillPath: undefined,
    }))

  if (skillCommands.length === 0) return []

  const allCommands = [...skillCommands, ...buildTriggerCommands(skillCommands)]
  const lines: string[] = []

  lines.push("**Available /commands:**")
  for (const cmd of allCommands.slice(0, 10)) {
    lines.push(`  /${cmd.command} — ${cmd.name}`)
  }

  const remaining = allCommands.length - 10
  if (remaining > 0) {
    lines.push(`  (+${remaining} more)`)
  }

  return lines
}

export function buildReminderMessage(availableSkills: AvailableSkill[]): string {
  const builtinSkills = availableSkills.filter((s) => s.location === "plugin")
  const customSkills = availableSkills.filter((s) => s.location !== "plugin")

  const builtinText = formatSkillNames(builtinSkills, 8)
  const customText = formatSkillNames(customSkills, 8)

  const exampleSkillName = customSkills[0]?.name ?? builtinSkills[0]?.name
  const loadSkills = exampleSkillName ? `["${exampleSkillName}"]` : "[]"

  const commandLines = buildCommandLines(availableSkills)

  const lines = [
    "",
    "[Category+Skill Reminder]",
    "",
    `**Built-in**: ${builtinText}`,
    `**⚡ YOUR SKILLS (PRIORITY)**: ${customText}`,
    "",
    "> User-installed skills OVERRIDE built-in defaults. ALWAYS prefer YOUR SKILLS when domain matches.",
    "",
    "```typescript",
    `task(category=\"visual-engineering\", load_skills=${loadSkills}, run_in_background=true)`,
    "```",
    "",
  ]

  if (commandLines.length > 0) {
    lines.push(...commandLines, "")
  }

  return lines.join("\n")
}
