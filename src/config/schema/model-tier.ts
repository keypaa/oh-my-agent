import { z } from "zod"

export const ModelTierConfigSchema = z.object({
  /** Agents that use cheap models */
  cheap: z.array(z.string()).default(["explore", "librarian", "sisyphus-junior"]),
  /** Agents that use medium-tier models */
  medium: z.array(z.string()).default(["momus", "metis", "cold-eyes"]),
  /** Agents that use expensive models */
  expensive: z.array(z.string()).default(["sisyphus", "hephaestus", "the-auditor", "ml-ai-engineering"]),
})

export type ModelTierConfig = z.infer<typeof ModelTierConfigSchema>
