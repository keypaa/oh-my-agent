import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, statSync } from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import type { TokenUsageEntry } from "./types"
import {
  appendEntry,
  readAllEntries,
  readEntriesFromBackup,
  filterBySession,
  filterByAgent,
} from "./store"

function makeEntry(overrides?: Partial<TokenUsageEntry>): TokenUsageEntry {
  return {
    sessionId: "session-1",
    agentName: "sisyphus",
    model: "gpt-4o",
    inputTokens: 100,
    outputTokens: 50,
    estimatedCost: 0.01,
    timestamp: "2025-01-01T00:00:00Z",
    ...overrides,
  }
}

function getStoreDir(): string {
  return process.env.OMA_COST_TRACKER_DIR ?? path.join(os.tmpdir(), "oma-cost-tracker-test")
}

function getStorePath(): string {
  return path.join(getStoreDir(), "cost-tracker.jsonl")
}

function getBackupPath(): string {
  return path.join(getStoreDir(), "cost-tracker.jsonl.1")
}

function cleanupStore(): void {
  try {
    const dir = getStoreDir()
    if (existsSync(getStorePath())) unlinkSync(getStorePath())
    if (existsSync(getBackupPath())) unlinkSync(getBackupPath())
    if (existsSync(dir)) {
      const { rmdirSync } = require("node:fs")
      rmdirSync(dir)
    }
  } catch {}
}

beforeEach(() => {
  process.env.OMA_COST_TRACKER_DIR = getStoreDir()
  cleanupStore()
  mkdirSync(getStoreDir(), { recursive: true })
})

afterEach(() => {
  cleanupStore()
  delete process.env.OMA_COST_TRACKER_DIR
})

describe("cost-tracker store", () => {
  describe("#given empty store", () => {
    test("#when readAllEntries #then returns empty array", () => {
      const entries = readAllEntries()
      expect(entries).toEqual([])
    })

    test("#when readEntriesFromBackup #then returns empty array", () => {
      const entries = readEntriesFromBackup()
      expect(entries).toEqual([])
    })
  })

  describe("#given entries", () => {
    test("#when appendEntry #then entry is persisted", () => {
      appendEntry(makeEntry())
      const entries = readAllEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].sessionId).toBe("session-1")
    })

    test("#when multiple entries appended #then all are persisted", () => {
      appendEntry(makeEntry({ sessionId: "s1" }))
      appendEntry(makeEntry({ sessionId: "s2" }))
      appendEntry(makeEntry({ sessionId: "s3" }))
      const entries = readAllEntries()
      expect(entries).toHaveLength(3)
    })
  })

  describe("#given corrupted lines", () => {
    test("#when file has corrupted lines #then those lines are skipped", () => {
      const storePath = getStorePath()
      writeFileSync(storePath, '{"valid":true}\nnot json\n{"also":"valid"}\n', "utf-8")
      const entries = readAllEntries()
      expect(entries).toHaveLength(2)
    })
  })

  describe("#given rotation", () => {
    test("#when file exceeds max size #then rotation occurs and new entries are still written", () => {
      const storePath = getStorePath()

      const largeContent = "x".repeat(10 * 1024 * 1024 + 1)
      writeFileSync(storePath, largeContent, "utf-8")
      expect(statSync(storePath).size).toBeGreaterThan(10 * 1024 * 1024)

      appendEntry(makeEntry({ sessionId: "after-rotate" }))

      const entries = readAllEntries()
      expect(entries.length).toBeGreaterThanOrEqual(1)
      expect(entries.some((e) => e.sessionId === "after-rotate")).toBe(true)
    })
  })

  describe("#given backup file", () => {
    test("#when main file missing but backup exists #then readEntriesFromBackup returns entries", () => {
      const backupPath = getBackupPath()
      const entry = makeEntry({ sessionId: "backup-session" })
      writeFileSync(backupPath, JSON.stringify(entry) + "\n", "utf-8")

      const entries = readEntriesFromBackup()
      expect(entries).toHaveLength(1)
      expect(entries[0].sessionId).toBe("backup-session")
    })

    test("#when backup file has corrupted lines #then corrupted lines are skipped", () => {
      const backupPath = getBackupPath()
      writeFileSync(backupPath, '{"valid":true}\nbad data\n', "utf-8")

      const entries = readEntriesFromBackup()
      expect(entries).toHaveLength(1)
    })
  })

  describe("#given filter functions", () => {
    test("#when filterBySession #then only matching entries returned", () => {
      appendEntry(makeEntry({ sessionId: "s1" }))
      appendEntry(makeEntry({ sessionId: "s2" }))
      appendEntry(makeEntry({ sessionId: "s1" }))

      const entries = readAllEntries()
      const filtered = filterBySession(entries, "s1")
      expect(filtered).toHaveLength(2)
    })

    test("#when filterByAgent #then only matching entries returned", () => {
      appendEntry(makeEntry({ agentName: "sisyphus" }))
      appendEntry(makeEntry({ agentName: "hephaestus" }))
      appendEntry(makeEntry({ agentName: "sisyphus" }))

      const entries = readAllEntries()
      const filtered = filterByAgent(entries, "sisyphus")
      expect(filtered).toHaveLength(2)
    })
  })
})
