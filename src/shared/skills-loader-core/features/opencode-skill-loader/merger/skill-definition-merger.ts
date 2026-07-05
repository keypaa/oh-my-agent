import type { LoadedSkill } from "../types"
import type { SkillDefinition } from "../../../types"
import { deepMerge } from "#shared/utils"

export function mergeSkillDefinitions(base: LoadedSkill, patch: SkillDefinition): LoadedSkill {
  const mergedMetadata = base.metadata || patch.metadata
    ? deepMerge(base.metadata || {}, (patch.metadata as Record<string, string>) || {})
    : undefined

  const mergedTools = base.allowedTools || patch["allowed-tools"]
    ? [...(base.allowedTools || []), ...(patch["allowed-tools"] || [])]
    : undefined

  const description = patch.description || base.definition.description?.replace(/^\([^)]+\) /, "")

  const patchTriggers = patch.triggers as string | string[] | undefined
  const mergedTriggers = base.triggers || patchTriggers
    ? [...(base.triggers || []), ...(Array.isArray(patchTriggers) ? patchTriggers : patchTriggers ? [patchTriggers] : [])]
    : undefined

  return {
    ...base,
    definition: {
      ...base.definition,
      description: `(${base.scope} - Skill) ${description}`,
      model: patch.model || base.definition.model,
      agent: patch.agent || base.definition.agent,
      subtask: patch.subtask ?? base.definition.subtask,
      argumentHint: patch["argument-hint"] || base.definition.argumentHint,
    },
    license: patch.license || base.license,
    compatibility: patch.compatibility || base.compatibility,
    metadata: mergedMetadata as Record<string, string> | undefined,
    allowedTools: mergedTools ? [...new Set(mergedTools)] : undefined,
    triggers: mergedTriggers ? [...new Set(mergedTriggers)] : undefined,
  }
}
