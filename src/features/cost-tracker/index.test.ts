import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import {
  recordTokenUsage,
  getSessionCost,
  getAgentCost,
  getAllCosts,
} from "./index"

const TEST_DIR = path.join(os.tmpdir(), "oma-cost-tracker-test-" + Date.now())

beforeEach(() => {
  process.env.OMA_COST_TRACKER_DIR = TEST_DIR
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  delete process.env.OMA_COST_TRACKER_DIR
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true })
  }
})

describe("cost-tracker", () => {
  describe("recordTokenUsage", () => {
    it("writes an entry to disk", () => {
      recordTokenUsage({
        sessionId: "s1",
        agentName: "Sisyphus",
        model: "anthropic/claude-sonnet-4",
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.015,
        timestamp: new Date().toISOString(),
      })

      const data = getAllCosts()
      expect(data.sessions.length).toBe(1)
      expect(data.grandTotalCost).toBe(0.015)
    })
  })

  describe("getSessionCost", () => {
    it("aggregates costs by agent for a session", () => {
      const now = new Date().toISOString()
      recordTokenUsage({
        sessionId: "s1",
        agentName: "Sisyphus",
        model: "anthropic/claude-sonnet-4",
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.01,
        timestamp: now,
      })
      recordTokenUsage({
        sessionId: "s1",
        agentName: "Hephaestus",
        model: "openai/gpt-5.5",
        inputTokens: 2000,
        outputTokens: 1000,
        estimatedCost: 0.02,
        timestamp: now,
      })

      const session = getSessionCost("s1")
      expect(session.totalCost).toBe(0.03)
      expect(session.totalInputTokens).toBe(3000)
      expect(session.totalOutputTokens).toBe(1500)
      expect(Object.keys(session.agents)).toHaveLength(2)
      expect(session.agents["Sisyphus"]?.callCount).toBe(1)
      expect(session.agents["Hephaestus"]?.callCount).toBe(1)
    })

    it("returns zeroed summary for unknown session", () => {
      const session = getSessionCost("unknown")
      expect(session.totalCost).toBe(0)
      expect(Object.keys(session.agents)).toHaveLength(0)
    })
  })

  describe("getAgentCost", () => {
    it("returns cost summary for a specific agent", () => {
      const now = new Date().toISOString()
      recordTokenUsage({
        sessionId: "s1",
        agentName: "Sisyphus",
        model: "anthropic/claude-sonnet-4",
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.01,
        timestamp: now,
      })
      recordTokenUsage({
        sessionId: "s1",
        agentName: "Sisyphus",
        model: "anthropic/claude-sonnet-4",
        inputTokens: 2000,
        outputTokens: 1000,
        estimatedCost: 0.02,
        timestamp: now,
      })

      const agent = getAgentCost("s1", "Sisyphus")
      expect(agent).toBeDefined()
      expect(agent!.totalCost).toBe(0.03)
      expect(agent!.callCount).toBe(2)
      expect(agent!.inputTokens).toBe(3000)
    })

    it("returns undefined for unknown agent", () => {
      const agent = getAgentCost("s1", "unknown")
      expect(agent).toBeUndefined()
    })
  })

  describe("getAllCosts", () => {
    it("aggregates across all sessions", () => {
      const now = new Date().toISOString()
      recordTokenUsage({
        sessionId: "s1",
        agentName: "Sisyphus",
        model: "anthropic/claude-sonnet-4",
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.01,
        timestamp: now,
      })
      recordTokenUsage({
        sessionId: "s2",
        agentName: "Hephaestus",
        model: "openai/gpt-5.5",
        inputTokens: 2000,
        outputTokens: 1000,
        estimatedCost: 0.02,
        timestamp: now,
      })

      const data = getAllCosts()
      expect(data.sessions.length).toBe(2)
      expect(data.grandTotalCost).toBe(0.03)
      expect(data.grandTotalInputTokens).toBe(3000)
    })

    it("returns empty summary when no data", () => {
      const data = getAllCosts()
      expect(data.sessions.length).toBe(0)
      expect(data.grandTotalCost).toBe(0)
    })
  })
})
