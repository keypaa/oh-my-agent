import { z } from "zod"

export const ProvenanceGuardConfigSchema = z.object({
  enabled: z.boolean().default(true),
  trusted_sources: z.array(z.string()).default([
    "github.com/obra/superpowers",
    "github.com/prime-radiant-inc/*",
  ]),
  min_repo_age_days: z.number().int().min(0).default(30),
  min_stars: z.number().int().min(0).default(10),
  require_permission_review: z.boolean().default(true),
})

export type ProvenanceGuardConfig = z.infer<typeof ProvenanceGuardConfigSchema>
