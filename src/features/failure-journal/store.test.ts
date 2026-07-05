import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import type { FailureRecord } from "./types"
import {
  appendEntry,
  readAllEntries,
  readEntriesFromBackup,
  writeResolved,
  filterByFile,
  filterByRecent,
  purgeOldEntries,
} from "./store"

function makeEntry(overrides?: Partial<FailureRecord>): FailureRecord {
  return {
    id: "f1",
    timestamp: "2025-01-01T00:00:00Z",
    sessionId: "session-1",
    filePath: "src/feature.ts",
    rootCause: "null reference",
    pattern: "null-reference",
    fixDescription: "Added null check",
    reportedBy: "the-auditor",
    resolved: false,
    ...overrides,
  }
}

function getStoreDir(): string {
  return process.env.OMA_FAILURE_JOURNAL_DIR ?? path.join(os.tmpdir(), "oma-failure-journal-test")
}

function getStorePath(): string {
  return path.join(getStoreDir(), "failure-journal.jsonl")
}

function getBackupPath(): string {
  return path.join(getStoreDir(), "failure-journal.jsonl.1")
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
  process.env.OMA_FAILURE_JOURNAL_DIR = getStoreDir()
  cleanupStore()
  mkdirSync(getStoreDir(), { recursive: true })
})

afterEach(() => {
  cleanupStore()
  delete process.env.OMA_FAILURE_JOURNAL_DIR
})

describe("failure-journal store", () => {
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
      expect(entries[0].id).toBe("f1")
    })

    test("#when multiple entries appended #then all are persisted", () => {
      appendEntry(makeEntry({ id: "f1" }))
      appendEntry(makeEntry({ id: "f2" }))
      appendEntry(makeEntry({ id: "f3" }))
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

      appendEntry(makeEntry({ id: "after-rotate" }))

      const entries = readAllEntries()
      expect(entries.length).toBeGreaterThanOrEqual(1)
      expect(entries.some((e) => e.id === "after-rotate")).toBe(true)
    })
  })

  describe("#given backup file", () => {
    test("#when main file missing but backup exists #then readEntriesFromBackup returns entries", () => {
      const backupPath = getBackupPath()
      const entry = makeEntry({ id: "backup-entry" })
      writeFileSync(backupPath, JSON.stringify(entry) + "\n", "utf-8")

      const entries = readEntriesFromBackup()
      expect(entries).toHaveLength(1)
      expect(entries[0].id).toBe("backup-entry")
    })

    test("#when backup file has corrupted lines #then corrupted lines are skipped", () => {
      const backupPath = getBackupPath()
      writeFileSync(backupPath, '{"valid":true}\nbad data\n', "utf-8")

      const entries = readEntriesFromBackup()
      expect(entries).toHaveLength(1)
    })
  })

  describe("#given writeResolved", () => {
    test("#when writeResolved #then file is rewritten with updated entries", () => {
      appendEntry(makeEntry({ id: "f1", resolved: false }))
      appendEntry(makeEntry({ id: "f2", resolved: false }))

      const entries = readAllEntries()
      entries[0].resolved = true
      writeResolved("f1", entries)

      const updated = readAllEntries()
      expect(updated).toHaveLength(2)
      expect(updated[0].resolved).toBe(true)
      expect(updated[1].resolved).toBe(false)
    })
  })

  describe("#given filter functions", () => {
    test("#when filterByFile #then only matching entries returned", () => {
      appendEntry(makeEntry({ filePath: "src/a.ts" }))
      appendEntry(makeEntry({ filePath: "src/b.ts" }))
      appendEntry(makeEntry({ filePath: "src/a.ts" }))

      const entries = readAllEntries()
      const filtered = filterByFile(entries, "src/a.ts")
      expect(filtered).toHaveLength(2)
    })

    test("#when filterByRecent #then entries sorted by timestamp descending", () => {
      appendEntry(makeEntry({ id: "f1", timestamp: "2025-01-01T00:00:00Z" }))
      appendEntry(makeEntry({ id: "f2", timestamp: "2025-01-03T00:00:00Z" }))
      appendEntry(makeEntry({ id: "f3", timestamp: "2025-01-02T00:00:00Z" }))

      const entries = readAllEntries()
      const recent = filterByRecent(entries, 2)
      expect(recent).toHaveLength(2)
      expect(recent[0].id).toBe("f2")
      expect(recent[1].id).toBe("f3")
    })

    test("#when filterByRecent #then resolved entries are excluded", () => {
      appendEntry(makeEntry({ id: "f1", resolved: true }))
      appendEntry(makeEntry({ id: "f2", resolved: false }))

      const entries = readAllEntries()
      const recent = filterByRecent(entries, 10)
      expect(recent).toHaveLength(1)
      expect(recent[0].id).toBe("f2")
    })
  })

  describe("#given purgeOldEntries", () => {
    test("#when entries older than maxAgeDays #then they are purged", () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 30)
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 1)

      appendEntry(makeEntry({ id: "f1", timestamp: oldDate.toISOString(), resolved: false }))
      appendEntry(makeEntry({ id: "f2", timestamp: recentDate.toISOString(), resolved: false }))

      const entries = readAllEntries()
      const { kept, purged } = purgeOldEntries(entries, 7)
      expect(purged).toBe(1)
      expect(kept).toHaveLength(1)
      expect(kept[0].id).toBe("f2")
    })

    test("#when resolved entries #then they are kept regardless of age", () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 30)

      appendEntry(makeEntry({ id: "f1", timestamp: oldDate.toISOString(), resolved: true }))

      const entries = readAllEntries()
      const { kept, purged } = purgeOldEntries(entries, 7)
      expect(purged).toBe(0)
      expect(kept).toHaveLength(1)
    })
  })
})
