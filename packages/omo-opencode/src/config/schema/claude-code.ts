import { z } from "zod/v4"

export const ClaudeCodeConfigSchema = z.object({
  mcp: z.boolean().default(true),
  commands: z.boolean().default(true),
  skills: z.boolean().default(true),
  agents: z.boolean().default(true),
  hooks: z.union([z.boolean(), z.array(z.string())]).optional(),
  plugins: z.boolean().default(true),
  plugins_override: z.record(z.boolean()).optional(),
  anthropic_provider: z.string().optional(),
})

export type ClaudeCodeConfig = z.infer<typeof ClaudeCodeConfigSchema>
