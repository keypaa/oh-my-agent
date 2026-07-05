import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import {
  recordFailure,
  getKnownIssuesForFile,
  getRecentFailures,
  markResolved,
} from "./index"

const TEST_DIR = path.join(os.tmpdir(), "oma-failure-journal-test-" + Date.now())

beforeEach(() => {
  process.env.OMA_FAILURE_JOURNAL_DIR = TEST_DIR
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  delete process.env.OMA_FAILURE_JOURNAL_DIR
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true })
  }
})

describe("failure-journal", () => {
  describe("recordFailure", () => {
    it("writes a record with generated id and timestamp", () => {
      const record = recordFailure({
        sessionId: "s1",
        filePath: "src/foo.ts",
        rootCause: "Off-by-one in loop",
        pattern: "off-by-one",
        fixDescription: "Changed < to <=",
        reportedBy: "the-auditor",
        resolved: false,
      })

      expect(record.id).toMatch(/^fj_/)
      expect(record.timestamp).toBeTruthy()
      expect(record.filePath).toBe("src/foo.ts")
      expect(record.resolved).toBe(false)
    })
  })

  describe("getKnownIssuesForFile", () => {
    it("returns unresolved records for a file", () => {
      recordFailure({
        sessionId: "s1",
        filePath: "src/foo.ts",
        rootCause: "Bug A",
        pattern: "logic-error",
        fixDescription: "Fix A",
        reportedBy: "the-auditor",
        resolved: false,
      })
      recordFailure({
        sessionId: "s1",
        filePath: "src/foo.ts",
        rootCause: "Bug B",
        pattern: "off-by-one",
        fixDescription: "Fix B",
        reportedBy: "cold-eyes",
        resolved: true,
      })
      recordFailure({
        sessionId: "s1",
        filePath: "src/bar.ts",
        rootCause: "Bug C",
        pattern: "null-reference",
        fixDescription: "Fix C",
        reportedBy: "the-auditor",
        resolved: false,
      })

      const issues = getKnownIssuesForFile("src/foo.ts")
      expect(issues.length).toBe(1)
      expect(issues[0]?.rootCause).toBe("Bug A")
    })

    it("returns empty array for file with no issues", () => {
      const issues = getKnownIssuesForFile("nonexistent.ts")
      expect(issues).toEqual([])
    })
  })

  describe("getRecentFailures", () => {
    it("returns recent unresolved failures in reverse chronological order", () => {
      recordFailure({
        sessionId: "s1",
        filePath: "a.ts",
        rootCause: "Bug A",
        pattern: "logic-error",
        fixDescription: "Fix A",
        reportedBy: "the-auditor",
        resolved: false,
      })
      recordFailure({
        sessionId: "s1",
        filePath: "b.ts",
        rootCause: "Bug B",
        pattern: "off-by-one",
        fixDescription: "Fix B",
        reportedBy: "cold-eyes",
        resolved: true,
      })

      const recent = getRecentFailures(10)
      expect(recent.length).toBe(1)
      expect(recent[0]?.rootCause).toBe("Bug A")
    })

    it("respects limit", () => {
      for (let i = 0; i < 5; i++) {
        recordFailure({
          sessionId: "s1",
          filePath: `file${i}.ts`,
          rootCause: `Bug ${i}`,
          pattern: "other",
          fixDescription: `Fix ${i}`,
          reportedBy: "user",
          resolved: false,
        })
      }

      const recent = getRecentFailures(3)
      expect(recent.length).toBe(3)
    })
  })

  describe("markResolved", () => {
    it("marks a record as resolved", () => {
      const record = recordFailure({
        sessionId: "s1",
        filePath: "src/foo.ts",
        rootCause: "Bug",
        pattern: "logic-error",
        fixDescription: "Fix",
        reportedBy: "the-auditor",
        resolved: false,
      })

      markResolved(record.id)

      const issues = getKnownIssuesForFile("src/foo.ts")
      expect(issues.length).toBe(0)

      // markResolved rewrites the file; verify the record is no longer returned as unresolved
      const recentAfter = getRecentFailures(100)
      const foundAfter = recentAfter.find((e) => e.id === record.id)
      expect(foundAfter).toBeUndefined()
    })
  })
})
