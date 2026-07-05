import { z } from "zod"

const GuardSeveritySchema = z.enum(["block", "warn"])

export const ConfidentialFilesConfigSchema = z.object({
  enabled: z.boolean().default(true),
  paths: z.array(z.string()).default([
    ".env",
    ".env.*",
    "**/secrets/**",
    "**/*.pem",
    "**/credentials.json",
    "**/service-account.json",
  ]),
  block_message: z.string().default("Access to '{path}' is blocked by security policy."),
})

export const SecretScannerSeverityConfigSchema = z.object({
  known_patterns: GuardSeveritySchema.default("block"),
  entropy: GuardSeveritySchema.default("warn"),
})

export const SecretScannerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SecretScannerSeverityConfigSchema.default({ known_patterns: "block", entropy: "warn" }),
  allowlist_patterns: z.array(z.string()).default(["test-*", "**/fixtures/**"]),
  allowlist_paths: z.array(z.string()).default(["**/*.test.ts", "**/*.md"]),
})

export type ConfidentialFilesConfig = z.infer<typeof ConfidentialFilesConfigSchema>
export type SecretScannerSeverityConfig = z.infer<typeof SecretScannerSeverityConfigSchema>
export type SecretScannerConfig = z.infer<typeof SecretScannerConfigSchema>
