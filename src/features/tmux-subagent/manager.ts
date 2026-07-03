import type { OhMyOpenCodeConfig } from "../../config"
import type { OpencodeClient } from "@opencode-ai/sdk"

export interface TmuxSessionManager {
  readonly config: OhMyOpenCodeConfig["team_mode"]
  readonly client: OpencodeClient
  readonly backgroundManager: unknown
  getServerUrl(): string
  getCtxServerUrl?(): string
}

export function createTmuxSessionManager(_config: OhMyOpenCodeConfig["team_mode"], _client: OpencodeClient, _backgroundManager: unknown): TmuxSessionManager {
  return { config: _config, client: _client, backgroundManager: _backgroundManager, getServerUrl: () => "", getCtxServerUrl: undefined }
}
