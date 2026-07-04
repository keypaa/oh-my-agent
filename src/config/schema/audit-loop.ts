import { z } from "zod"

export const AuditLoopConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Maximum audit cycles before escalating to mandatory human review */
  max_cycles: z.number().min(1).max(10).default(3),
  /** Skip Verifier 2 (Cold-Eyes) for faster audits */
  skip_verifier_2: z.boolean().default(false),
})

export type AuditLoopConfig = z.infer<typeof AuditLoopConfigSchema>
