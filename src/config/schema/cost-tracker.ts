import { z } from "zod"

export const CostTrackerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Maximum file size in MB before rotation (keeps 1 backup) */
  max_file_size_mb: z.number().min(1).max(100).default(10),
})

export type CostTrackerConfig = z.infer<typeof CostTrackerConfigSchema>
