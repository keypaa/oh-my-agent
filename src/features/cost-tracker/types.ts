export interface TokenUsageEntry {
  sessionId: string
  agentName: string
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  timestamp: string
}

export interface AgentCostSummary {
  agentName: string
  model: string
  totalCost: number
  inputTokens: number
  outputTokens: number
  callCount: number
}

export interface SessionCostSummary {
  sessionId: string
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  agents: Record<string, AgentCostSummary>
}

export interface CostSummary {
  sessions: SessionCostSummary[]
  grandTotalCost: number
  grandTotalInputTokens: number
  grandTotalOutputTokens: number
}
