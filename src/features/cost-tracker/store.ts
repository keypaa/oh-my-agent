import { existsSync, mkdirSync, readFileSync, appendFileSync, renameSync, statSync } from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { log } from "../../shared/logger"
import type { TokenUsageEntry } from "./types"

const FILENAME = "cost-tracker.jsonl"
const BACKUP_FILENAME = "cost-tracker.jsonl.1"
const MAX_SIZE_BYTES = 10 * 1024 * 1024

function resolveStoreDir(): string {
  const override = process.env.OMA_COST_TRACKER_DIR
  if (override) return override

  const isTest = process.env.BUN_TEST !== undefined || process.env.NODE_ENV === "test"
  if (isTest) return path.join(os.tmpdir(), "oma-cost-tracker-test")

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
    log("[cost-tracker] Failed to rotate file", { error: String(error) })
  }
}

export function appendEntry(entry: TokenUsageEntry): void {
  try {
    const dir = resolveStoreDir()
    ensureDir(dir)
    const filePath = resolveStorePath()
    rotateIfNeeded(filePath, resolveBackupPath())
    const line = JSON.stringify(entry) + "\n"
    appendFileSync(filePath, line, "utf-8")
  } catch (error) {
    log("[cost-tracker] Failed to write entry", { error: String(error) })
  }
}

export function readAllEntries(): TokenUsageEntry[] {
  const filePath = resolveStorePath()
  if (!existsSync(filePath)) return []

  try {
    const content = readFileSync(filePath, "utf-8")
    const lines = content.split("\n").filter((l) => l.trim().length > 0)
    const entries: TokenUsageEntry[] = []
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as TokenUsageEntry)
      } catch {
        log("[cost-tracker] Skipping corrupted line", { line: line.slice(0, 100) })
      }
    }
    return entries
  } catch {
    return []
  }
}

export function readEntriesFromBackup(): TokenUsageEntry[] {
  const backupPath = resolveBackupPath()
  if (!existsSync(backupPath)) return []

  try {
    const content = readFileSync(backupPath, "utf-8")
    const lines = content.split("\n").filter((l) => l.trim().length > 0)
    const entries: TokenUsageEntry[] = []
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as TokenUsageEntry)
      } catch {
        // skip corrupted lines
      }
    }
    return entries
  } catch {
    return []
  }
}

export function filterBySession(
  entries: TokenUsageEntry[],
  sessionId: string,
): TokenUsageEntry[] {
  return entries.filter((e) => e.sessionId === sessionId)
}

export function filterByAgent(
  entries: TokenUsageEntry[],
  agentName: string,
): TokenUsageEntry[] {
  return entries.filter((e) => e.agentName === agentName)
}
