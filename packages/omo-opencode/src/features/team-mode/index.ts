export * from "./types"
export * from "./team-worktree"

import { setTeamCoreLogger } from "#shared/team-core"

import { log } from "../../shared/logger"

setTeamCoreLogger(log)
