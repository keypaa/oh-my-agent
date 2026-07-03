import type { TuiPluginModule } from "@opencode-ai/plugin/tui"

import { log } from "./shared/logger"

export function handleTuiPollError(
  error: unknown,
  reportPollError: (error: Error) => void = (pollError) => log("[tui-sidebar] polling failed", { error: pollError }),
): void {
  if (error instanceof Error) {
    reportPollError(error)
    return
  }
  throw error
}

const module: TuiPluginModule = {
  id: "oh-my-agent:tui",
  tui: async () => {},
}

export default module
