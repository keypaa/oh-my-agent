export type CleanupPlatform = "codex"

export interface CleanupOptions {
  readonly platform?: CleanupPlatform | "opencode" | "both"
  readonly codexHome?: string
  readonly project?: string
  readonly json?: boolean
}

export function resolveCleanupPlatform(
  options: { readonly platform?: CleanupOptions["platform"] },
  invocationName: string | undefined = process.env.OMA_INVOCATION_NAME,
): CleanupOptions["platform"] | undefined {
  if (options.platform !== undefined) return options.platform
  return invocationName === "lazycodex" || invocationName === "lazycodex-ai" ? "codex" : undefined
}

export async function cleanup(_options: CleanupOptions): Promise<number> {
  return 0
}
