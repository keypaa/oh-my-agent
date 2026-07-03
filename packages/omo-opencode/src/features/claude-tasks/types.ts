export interface Task {
  readonly id: string
  readonly subject: string
  readonly description: string
  readonly status: "pending" | "in_progress" | "completed" | "deleted"
  readonly blocks: string[]
  readonly blockedBy: string[]
  readonly threadID: string
  readonly activeForm?: string
  readonly owner?: string
  readonly metadata?: Record<string, unknown>
  readonly repoURL?: string
  readonly parentID?: string
}
