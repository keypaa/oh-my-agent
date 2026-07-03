export interface CommandDefinition {
  readonly name: string
  readonly description?: string
  readonly metadata?: Record<string, unknown>
  readonly content?: string
  readonly subtask?: boolean
  readonly model?: string
  readonly agent?: string
  readonly argumentHint?: string
  readonly hidden?: boolean
  readonly scope?: string
}
