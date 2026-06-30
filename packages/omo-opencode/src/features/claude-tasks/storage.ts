export function getTaskDir(_config: unknown): string {
  return ""
}

export function readJsonSafe(_path: string, _schema: unknown): unknown {
  return null
}

export function writeJsonAtomic(_path: string, _data: unknown): void {}

export function acquireLock(_lockPath: string): () => void {
  return () => {}
}

export function generateTaskId(): string {
  return ""
}
