import type { FailureRecord, FailureReporter, FailurePattern } from "./types"
import {
  appendEntry,
  readAllEntries,
  writeResolved,
  filterByFile,
  filterByRecent,
} from "./store"

export type { FailureRecord, FailureReporter, FailurePattern }

export function recordFailure(
  entry: Omit<FailureRecord, "id" | "timestamp">,
): FailureRecord {
  const record: FailureRecord = {
    ...entry,
    id: generateId(),
    timestamp: new Date().toISOString(),
  }
  appendEntry(record)
  return record
}

export function getKnownIssuesForFile(filePath: string): FailureRecord[] {
  return filterByFile(readAllEntries(), filePath)
}

export function getRecentFailures(limit = 20): FailureRecord[] {
  return filterByRecent(readAllEntries(), limit)
}

export function markResolved(id: string): void {
  const entries = readAllEntries()
  const updated = entries.map((e) =>
    e.id === id ? { ...e, resolved: true } : e,
  )
  writeResolved(id, updated)
}

function generateId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `fj_${timestamp}_${random}`
}
