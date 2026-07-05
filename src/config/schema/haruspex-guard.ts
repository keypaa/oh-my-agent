import { z } from "zod"

export const HaruspexGuardConfigSchema = z.object({
  enabled: z.boolean().default(true),
  allowed_paths: z.array(z.string()).default([
    "src/agents/**",
    "src/hooks/**",
    "src/features/builtin-skills/**",
    "src/config/schema/**",
    "src/cli/**",
    "packages/shared-skills/**",
    "docs/**",
    "*.md",
  ]),
  denied_paths: z.array(z.string()).default([
    "src/plugin/**",
    "src/shared/**",
    "src/mcp/**",
    "package.json",
    "bun.lock",
    ".git/**",
  ]),
  require_confirmation: z.array(z.string()).default([
    "src/agents/builtin-agents.ts",
    "src/config/schema/oh-my-opencode-config.ts",
    "src/plugin-handlers/**",
  ]),
  show_diff: z.boolean().default(true),
})

export type HaruspexGuardConfig = z.infer<typeof HaruspexGuardConfigSchema>
