import {
  getRecentFailures,
  getKnownIssuesForFile,
  markResolved,
  recordFailure,
} from "../../features/failure-journal"
import type { FailureRecord } from "../../features/failure-journal"

type JournalOptions = {
  file?: string
  limit?: number
  resolve?: string
  record?: boolean
  sessionId?: string
  rootCause?: string
  pattern?: string
  fix?: string
  reportedBy?: string
  filePath?: string
  json?: boolean
}

function printFailure(f: FailureRecord): void {
  const status = f.resolved ? "[RESOLVED]" : "[OPEN]"
  console.log(`${status} ${f.id} (${f.timestamp})`)
  console.log(`  File: ${f.filePath}`)
  console.log(`  Root cause: ${f.rootCause}`)
  console.log(`  Pattern: ${f.pattern}`)
  console.log(`  Fix: ${f.fixDescription}`)
  console.log(`  Reported by: ${f.reportedBy}`)
  console.log()
}

function printFailures(failures: FailureRecord[]): void {
  if (failures.length === 0) {
    console.log("No failure records found.")
    return
  }

  console.log(`Found ${failures.length} failure record(s):\n`)
  for (const f of failures) {
    printFailure(f)
  }
}

export async function journalCommand(options: JournalOptions): Promise<void> {
  if (options.resolve) {
    markResolved(options.resolve)
    console.log(`Marked failure ${options.resolve} as resolved.`)
    return
  }

  if (options.record) {
    if (!options.sessionId || !options.rootCause || !options.filePath || !options.fix || !options.reportedBy) {
      console.error("Error: --record requires --session-id, --root-cause, --file-path, --fix, and --reported-by")
      process.exit(1)
    }
    const record = recordFailure({
      sessionId: options.sessionId,
      filePath: options.filePath,
      rootCause: options.rootCause,
      pattern: (options.pattern as FailureRecord["pattern"]) ?? "other",
      fixDescription: options.fix,
      reportedBy: options.reportedBy as FailureRecord["reportedBy"],
      resolved: false,
    })
    console.log(`Recorded failure: ${record.id}`)
    return
  }

  let failures: FailureRecord[]

  if (options.file) {
    failures = getKnownIssuesForFile(options.file)
  } else {
    failures = getRecentFailures(options.limit ?? 20)
  }

  if (options.json) {
    console.log(JSON.stringify(failures, null, 2))
    return
  }

  printFailures(failures)
}
