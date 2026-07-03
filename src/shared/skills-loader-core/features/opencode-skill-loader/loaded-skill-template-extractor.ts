import { readFileSync } from "node:fs"
import { parseFrontmatter } from "#shared/utils"
import type { CommandDefinition } from "#shared/claude-code-compat-core/claude-code-command-loader/types"
import type { LoadedSkill } from "./types"

export function extractSkillTemplate(skill: LoadedSkill): string {
  const def = skill.definition as CommandDefinition & { template?: string }
  if (skill.scope === "config" && def.template) {
    return def.template
  }

  if (skill.path) {
    const content = readFileSync(skill.path, "utf-8")
    const { body } = parseFrontmatter(content)
		return body.trim()
	}
	return def.template || ""
}
