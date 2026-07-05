import { getAllCosts, getSessionCost, getAgentCost } from "../../features/cost-tracker"
import type { CostSummary } from "../../features/cost-tracker"

type CostOptions = {
  session?: string
  agent?: string
  json?: boolean
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(4)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function printCostSummary(data: CostSummary): void {
  if (data.sessions.length === 0) {
    console.log("No cost data recorded yet.")
    return
  }

  console.log("Cost Summary")
  console.log("─".repeat(60))
  console.log(
    `Grand Total: ${formatCurrency(data.grandTotalCost)} | ` +
      `${formatTokens(data.grandTotalInputTokens)} in / ${formatTokens(data.grandTotalOutputTokens)} out`,
  )
  console.log("─".repeat(60))

  for (const session of data.sessions) {
    console.log(`\nSession: ${session.sessionId}`)
    console.log(
      `  Total: ${formatCurrency(session.totalCost)} | ` +
        `${formatTokens(session.totalInputTokens)} in / ${formatTokens(session.totalOutputTokens)} out`,
    )

    const agentEntries = Object.values(session.agents)
    if (agentEntries.length > 0) {
      console.log("  Agents:")
      for (const agent of agentEntries) {
        console.log(
          `    ${agent.agentName} (${agent.model}): ` +
            `${formatCurrency(agent.totalCost)} | ` +
            `${agent.callCount} calls | ` +
            `${formatTokens(agent.inputTokens)} in / ${formatTokens(agent.outputTokens)} out`,
        )
      }
    }
  }
}

function printSessionCost(sessionId: string): void {
  const data = getSessionCost(sessionId)
  console.log(`Session: ${data.sessionId}`)
  console.log(
    `Total: ${formatCurrency(data.totalCost)} | ` +
      `${formatTokens(data.totalInputTokens)} in / ${formatTokens(data.totalOutputTokens)} out`,
  )

  const agentEntries = Object.values(data.agents)
  if (agentEntries.length > 0) {
    console.log("Agents:")
    for (const agent of agentEntries) {
      console.log(
        `  ${agent.agentName} (${agent.model}): ` +
          `${formatCurrency(agent.totalCost)} | ` +
          `${agent.callCount} calls | ` +
          `${formatTokens(agent.inputTokens)} in / ${formatTokens(agent.outputTokens)} out`,
      )
    }
  } else {
    console.log("No agent data for this session.")
  }
}

function printAgentCost(sessionId: string, agentName: string): void {
  const data = getAgentCost(sessionId, agentName)
  if (!data) {
    console.log(`No cost data for agent "${agentName}" in session "${sessionId}".`)
    return
  }

  console.log(`Agent: ${data.agentName}`)
  console.log(`Model: ${data.model}`)
  console.log(`Calls: ${data.callCount}`)
  console.log(`Cost: ${formatCurrency(data.totalCost)}`)
  console.log(`Tokens: ${formatTokens(data.inputTokens)} in / ${formatTokens(data.outputTokens)} out`)
}

export async function costCommand(options: CostOptions): Promise<void> {
  if (options.json) {
    if (options.session) {
      if (options.agent) {
        const data = getAgentCost(options.session, options.agent)
        console.log(JSON.stringify(data ?? null, null, 2))
      } else {
        const data = getSessionCost(options.session)
        console.log(JSON.stringify(data, null, 2))
      }
    } else {
      const data = getAllCosts()
      console.log(JSON.stringify(data, null, 2))
    }
    return
  }

  if (options.session && options.agent) {
    printAgentCost(options.session, options.agent)
  } else if (options.session) {
    printSessionCost(options.session)
  } else {
    printCostSummary(getAllCosts())
  }
}
