import { z } from "zod"

export const FailureJournalConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Maximum age in days before old entries are purged */
  max_age_days: z.number().min(1).max(365).default(90),
})

export type FailureJournalConfig = z.infer<typeof FailureJournalConfigSchema>
