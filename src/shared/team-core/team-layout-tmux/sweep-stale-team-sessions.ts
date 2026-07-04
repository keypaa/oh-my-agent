const UUID_V4ISH_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

export const TEAM_SESSION_PATTERN = new RegExp(`^omo-team-(${UUID_V4ISH_PATTERN})$`)

export type TeamSweepDeps = {
	listCandidates: () => Promise<string[]>
	killSession: (name: string) => Promise<void>
	log: (message: string, payload?: unknown) => void
}

export async function sweepStaleTeamSessionsWith(
	activeTeamRunIds: ReadonlySet<string>,
	deps: TeamSweepDeps,
): Promise<string[]> {
	const candidates = await deps.listCandidates()
	const results: string[] = []

	for (const sessionName of candidates) {
		const teamRunId = sessionName.match(TEAM_SESSION_PATTERN)?.[1]
		if (teamRunId !== undefined && teamRunId.length > 0 && !activeTeamRunIds.has(teamRunId)) {
			await deps.killSession(sessionName)
			results.push(sessionName)
		}
	}

	return results
}

export async function sweepStaleTeamSessions(activeTeamRunIds: ReadonlySet<string>): Promise<string[]> {
	const { log } = await import("../logger")
	const tmuxPath = "tmux"

	return sweepStaleTeamSessionsWith(activeTeamRunIds, {
		listCandidates: async () => [],
		killSession: async () => {},
		log,
	})
}
