import { existsSync, mkdirSync, readFileSync, appendFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { log } from "../../shared/logger"
import type { FailureRecord } from "./types"

const FILENAME = "failure-journal.jsonl"
const BACKUP_FILENAME = "failure-journal.jsonl.1"
const MAX_SIZE_BYTES = 10 * 1024 * 1024

function resolveStoreDir(): string {
  const override = process.env.OMA_FAILURE_JOURNAL_DIR
  if (override) return override

  const isTest = process.env.BUN_TEST !== undefined || process.env.NODE_ENV === "test"
  if (isTest) return path.join(os.tmpdir(), "oma-failure-journal-test")

  const configDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config")
  return path.join(configDir, "oh-my-agent")
}

function resolveStorePath(): string {
  return path.join(resolveStoreDir(), FILENAME)
}

function resolveBackupPath(): string {
  return path.join(resolveStoreDir(), BACKUP_FILENAME)
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function rotateIfNeeded(filePath: string, backupPath: string): void {
  try {
    if (!existsSync(filePath)) return
    const stat = statSync(filePath)
    if (stat.size < MAX_SIZE_BYTES) return
    if (existsSync(backupPath)) {
      const { unlinkSync } = require("node:fs")
      unlinkSync(backupPath)
    }
    renameSync(filePath, backupPath)
  } catch (error) {
    log("[failure-journal] Failed to rotate file", { error: String(error) })
  }
}

export function appendEntry(entry: FailureRecord): void {
  try {
    const dir = resolveStoreDir()
    ensureDir(dir)
    const filePath = resolveStorePath()
    rotateIfNeeded(filePath, resolveBackupPath())
    const line = JSON.stringify(entry) + "\n"
    appendFileSync(filePath, line, "utf-8")
  } catch (error) {
    log("[failure-journal] Failed to write entry", { error: String(error) })
  }
}

export function readAllEntries(): FailureRecord[] {
  const filePath = resolveStorePath()
  if (!existsSync(filePath)) return []

  try {
    const content = readFileSync(filePath, "utf-8")
    const lines = content.split("\n").filter((l) => l.trim().length > 0)
    const entries: FailureRecord[] = []
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as FailureRecord)
      } catch {
        log("[failure-journal] Skipping corrupted line", { line: line.slice(0, 100) })
      }
    }
    return entries
  } catch {
    return []
  }
}

export function readEntriesFromBackup(): FailureRecord[] {
  const backupPath = resolveBackupPath()
  if (!existsSync(backupPath)) return []

  try {
    const content = readFileSync(backupPath, "utf-8")
    const lines = content.split("\n").filter((l) => l.trim().length > 0)
    const entries: FailureRecord[] = []
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as FailureRecord)
      } catch {
        // skip corrupted lines
      }
    }
    return entries
  } catch {
    return []
  }
}

export function writeResolved(id: string, entries: FailureRecord[]): void {
  try {
    const dir = resolveStoreDir()
    ensureDir(dir)
    const filePath = resolveStorePath()
    const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n"
    writeFileSync(filePath, content, "utf-8")
  } catch (error) {
    log("[failure-journal] Failed to write resolved state", { error: String(error) })
  }
}

export function filterByFile(
  entries: FailureRecord[],
  filePath: string,
): FailureRecord[] {
  return entries.filter((e) => e.filePath === filePath && !e.resolved)
}

export function filterByRecent(
  entries: FailureRecord[],
  limit: number,
): FailureRecord[] {
  return entries
    .filter((e) => !e.resolved)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
}

export function purgeOldEntries(
  entries: FailureRecord[],
  maxAgeDays: number,
): { kept: FailureRecord[]; purged: number } {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - maxAgeDays)
  const cutoffISO = cutoff.toISOString()

  const kept = entries.filter((e) => e.resolved || e.timestamp >= cutoffISO)
  const purged = entries.length - kept.length
  return { kept, purged }
}
