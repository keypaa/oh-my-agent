export interface OAuthTokenData {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  clientInfo?: {
    clientId: string
    clientSecret?: string
  }
}

export interface McpOAuthProviderOptions {
  serverUrl: string
  clientId?: string
  scopes?: string[]
}

export class McpOAuthProvider {
  constructor(_options: McpOAuthProviderOptions) {}
  tokens(): OAuthTokenData | null { return null }
  async login(): Promise<OAuthTokenData> { throw new Error("OAuth not available") }
  async refresh(_refreshToken: string): Promise<OAuthTokenData> { throw new Error("OAuth not available") }
}

const ongoingRefreshes = new Map<string, Promise<OAuthTokenData>>()

export async function withRefreshMutex(
  serverUrl: string,
  refreshFn: () => Promise<OAuthTokenData>,
): Promise<OAuthTokenData> {
  const existing = ongoingRefreshes.get(serverUrl)
  if (existing) {
    return existing
  }

  const refreshPromise = refreshFn().finally(() => {
    ongoingRefreshes.delete(serverUrl)
  })

  ongoingRefreshes.set(serverUrl, refreshPromise)
  return refreshPromise
}

export interface StepUpInfo {
  requiredScopes: string[]
  error?: string
  errorDescription?: string
}

export function isStepUpRequired(_statusCode: number, _headers: Record<string, string>): StepUpInfo | null {
  return null
}

export function mergeScopes(existing: string[], required: string[]): string[] {
  return [...new Set([...existing, ...required])]
}
