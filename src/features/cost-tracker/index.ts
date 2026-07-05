import type { TokenUsageEntry, SessionCostSummary, AgentCostSummary, CostSummary } from "./types"
import {
  appendEntry,
  readAllEntries,
  filterBySession,
  filterByAgent,
} from "./store"

export type { TokenUsageEntry, SessionCostSummary, AgentCostSummary, CostSummary }

export function recordTokenUsage(entry: TokenUsageEntry): void {
  appendEntry(entry)
}

export function getSessionCost(sessionId: string): SessionCostSummary {
  const entries = filterBySession(readAllEntries(), sessionId)

  const agents: Record<string, AgentCostSummary> = {}
  let totalCost = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (const entry of entries) {
    totalCost += entry.estimatedCost
    totalInputTokens += entry.inputTokens
    totalOutputTokens += entry.outputTokens

    const existing = agents[entry.agentName]
    if (existing) {
      existing.totalCost += entry.estimatedCost
      existing.inputTokens += entry.inputTokens
      existing.outputTokens += entry.outputTokens
      existing.callCount++
    } else {
      agents[entry.agentName] = {
        agentName: entry.agentName,
        model: entry.model,
        totalCost: entry.estimatedCost,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        callCount: 1,
      }
    }
  }

  return {
    sessionId,
    totalCost,
    totalInputTokens,
    totalOutputTokens,
    agents,
  }
}

export function getAgentCost(
  sessionId: string,
  agentName: string,
): AgentCostSummary | undefined {
  const entries = filterByAgent(filterBySession(readAllEntries(), sessionId), agentName)

  if (entries.length === 0) return undefined

  let totalCost = 0
  let inputTokens = 0
  let outputTokens = 0
  let model = ""

  for (const entry of entries) {
    totalCost += entry.estimatedCost
    inputTokens += entry.inputTokens
    outputTokens += entry.outputTokens
    model = entry.model
  }

  return {
    agentName,
    model,
    totalCost,
    inputTokens,
    outputTokens,
    callCount: entries.length,
  }
}

export function getAllCosts(): CostSummary {
  const entries = readAllEntries()
  const sessionMap = new Map<string, TokenUsageEntry[]>()

  for (const entry of entries) {
    const existing = sessionMap.get(entry.sessionId) ?? []
    existing.push(entry)
    sessionMap.set(entry.sessionId, existing)
  }

  const sessions: SessionCostSummary[] = []
  let grandTotalCost = 0
  let grandTotalInputTokens = 0
  let grandTotalOutputTokens = 0

  for (const [sessionId, sessionEntries] of sessionMap) {
    const agents: Record<string, AgentCostSummary> = {}
    let sessionTotalCost = 0
    let sessionTotalInput = 0
    let sessionTotalOutput = 0

    for (const entry of sessionEntries) {
      sessionTotalCost += entry.estimatedCost
      sessionTotalInput += entry.inputTokens
      sessionTotalOutput += entry.outputTokens

      const existing = agents[entry.agentName]
      if (existing) {
        existing.totalCost += entry.estimatedCost
        existing.inputTokens += entry.inputTokens
        existing.outputTokens += entry.outputTokens
        existing.callCount++
      } else {
        agents[entry.agentName] = {
          agentName: entry.agentName,
          model: entry.model,
          totalCost: entry.estimatedCost,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          callCount: 1,
        }
      }
    }

    sessions.push({
      sessionId,
      totalCost: sessionTotalCost,
      totalInputTokens: sessionTotalInput,
      totalOutputTokens: sessionTotalOutput,
      agents,
    })

    grandTotalCost += sessionTotalCost
    grandTotalInputTokens += sessionTotalInput
    grandTotalOutputTokens += sessionTotalOutput
  }

  return {
    sessions,
    grandTotalCost,
    grandTotalInputTokens,
    grandTotalOutputTokens,
  }
}
