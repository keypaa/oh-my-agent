import type { TeamModeConfig } from "../../../config/schema/team-mode"
import { createTeamLayout } from "../team-layout-tmux/layout"
import type { TeamLayoutResult } from "../team-layout-tmux/layout"
import type { RuntimeState } from "../types"
import { transitionRuntimeState } from "../team-state-store/store"

function normalizeTeamLayout(teamRunId: string, layout: TeamLayoutResult): TeamLayoutResult {
  return {
    ...layout,
    targetSessionId: layout.targetSessionId ?? `omo-team-${teamRunId}`,
    ownedSession: layout.ownedSession ?? true,
  }
}

export async function activateTeamLayout(
  runtimeState: RuntimeState,
  config: TeamModeConfig,
  projectRoot: string,
): Promise<boolean> {
  return false
}
