import { z } from "zod"

export const TmuxIsolationSchema = z.object({
  enabled: z.boolean().default(false),
})

export type TmuxIsolation = z.infer<typeof TmuxIsolationSchema>

export const TmuxLayoutSchema = z.object({
  enabled: z.boolean().default(false),
})

export type TmuxLayout = z.infer<typeof TmuxLayoutSchema>

export const TmuxConfigSchema = z.object({
  enabled: z.boolean().default(false),
  isolation: TmuxIsolationSchema.optional(),
})

export type TmuxConfig = z.infer<typeof TmuxConfigSchema>
