export type RiskLevel = "low" | "medium" | "high"

export type ProvenanceCheckResult = {
  allowed: boolean
  reason?: string
  requiresConfirmation?: boolean
  requiresApproval?: boolean
  permissions?: string[]
  riskLevel: RiskLevel
}

export type RepoInfo = {
  fullName: string
  createdAt: string
  stargazersCount: number
  description: string | null
}

export type PermissionEntry = {
  type: "tool" | "mcp" | "command"
  name: string
}
