export type ClaudeCodeMcpServer = {
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  headers?: Record<string, string>
  [key: string]: unknown
}
