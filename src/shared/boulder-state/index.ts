// Stub module - boulder is CUT (Completely Unused/Untested)
// All exports provide minimal implementations that won't break compilation

export const BOULDER_DIR = ".omo/boulder-state"
export const BOULDER_FILE = "state.json"
export const BOULDER_STATE_PATH = ".omo/boulder-state/state.json"
export const NOTEPAD_BASE_PATH = ".omo/notepads"
export const NOTEPAD_DIR = ".omo/notepads"
export const PROMETHEUS_PLANS_DIR = ".omo/plans"

export interface BoulderState {
  schema_version?: number
  active_work_id?: string
  works?: Record<string, BoulderWorkState>
  active_plan: string
  started_at: string
  ended_at?: string
  elapsed_ms?: number
  status?: BoulderWorkStatus
  updated_at?: string
  session_ids: string[]
  session_origins?: Record<string, BoulderSessionOrigin>
  plan_name: string
  agent?: string
  worktree_path?: string
  task_sessions?: Record<string, TaskSessionState>
}

export type BoulderSessionOrigin = "direct" | "appended"
export type BoulderWorkStatus = "active" | "completed" | "paused" | "abandoned"
export type BoulderTaskStatus = "running" | "completed" | "cancelled"

export interface BoulderWorkState {
  work_id: string
  active_plan: string
  plan_name: string
  status?: BoulderWorkStatus
  started_at: string
  ended_at?: string
  elapsed_ms?: number
  updated_at?: string
  session_ids: string[]
  session_origins?: Record<string, BoulderSessionOrigin>
  agent?: string
  worktree_path?: string
  task_sessions?: Record<string, TaskSessionState>
}

export interface PlanProgress {
  total: number
  completed: number
  isComplete: boolean
}

export interface PlanChecklist {
  total: number
  completed: number
  remaining: number
  nextTaskLabel: string | null
}

export interface TaskSessionState {
  task_key: string
  task_label: string
  task_title: string
  session_id: string
  agent?: string
  category?: string
  started_at?: string
  ended_at?: string
  elapsed_ms?: number
  status?: BoulderTaskStatus
  updated_at: string
}

export interface BoulderWorkResumeOption {
  work_id: string
  plan_name: string
  active_plan: string
  worktree_path?: string
  status: BoulderWorkStatus
  started_at: string
  updated_at: string
  ended_at?: string
  elapsed_ms?: number
  session_count: number
  progress: PlanProgress
  is_current_mirror: boolean
}

export interface TopLevelTaskRef {
  key: string
  section: "todo" | "final-wave"
  label: string
  title: string
}

// Stub implementations - using overloaded signatures to match callers
export function getPlanChecklist(_planPath: string): PlanChecklist {
  return { total: 0, completed: 0, remaining: 0, nextTaskLabel: null }
}

export function parsePlanChecklist(_content: string): PlanChecklist {
  return { total: 0, completed: 0, remaining: 0, nextTaskLabel: null }
}

export function readCurrentTopLevelTask(_planPath: string): TopLevelTaskRef | null {
  return null
}

export function addBoulderWork(_stateOrDir: BoulderState | string, _work?: BoulderWorkState | { planPath?: string; sessionId?: string; agent?: string; worktreePath?: string }): BoulderState {
  const base: BoulderState = { active_plan: "", started_at: new Date().toISOString(), session_ids: [], plan_name: "" }
  return base
}

export function appendSessionId(_stateOrDir: BoulderState | string, _sessionIdOrOrigin?: string, _originOrUnused?: BoulderSessionOrigin | string): BoulderState {
  return { active_plan: "", started_at: new Date().toISOString(), session_ids: [], plan_name: "" }
}

export function appendSessionIdForWork(_stateOrDir: BoulderState | string, _workIdOrSession?: string, _sessionIdOrOrigin?: string, _originOrUnused?: BoulderSessionOrigin | string): BoulderState {
  return { active_plan: "", started_at: new Date().toISOString(), session_ids: [], plan_name: "" }
}

export function clearBoulderState(_directory: string): void {}

export function completeBoulder(_stateOrDir: BoulderState | string, _workIdOrUnused?: string): BoulderState {
  return { active_plan: "", started_at: new Date().toISOString(), session_ids: [], plan_name: "" }
}

export function createBoulderState(_planPathOrDir: string, _sessionIdOrPlanName?: string, _agentOrUnused?: string, _worktreePathOrUnused?: string): BoulderState {
  return { active_plan: "", started_at: new Date().toISOString(), session_ids: [], plan_name: _sessionIdOrPlanName ?? "" }
}

export function endTaskTimer(_stateOrDir: BoulderState | string, _workIdOrTaskKey: string, _taskKeyOrUnused?: string): BoulderState {
  return { active_plan: "", started_at: new Date().toISOString(), session_ids: [], plan_name: "" }
}

export function findPrometheusPlans(_directory: string): string[] {
  return []
}

export function generateWorkId(): string {
  return `work-${Date.now()}`
}

export function getActiveWorks(_stateOrDir: BoulderState | string): BoulderWorkState[] {
  return []
}

export function getBoulderFilePath(_directory: string): string {
  return BOULDER_STATE_PATH
}

export function getBoulderWorks(_stateOrDir: BoulderState | string): BoulderWorkState[] {
  return []
}

export function getPlanName(_stateOrDir: BoulderState | string): string {
  return ""
}

export function getPlanProgress(_planPath: string): PlanProgress {
  return { total: 0, completed: 0, isComplete: false }
}

export function getTaskSessionState(_stateOrDir: BoulderState | string, _taskKey: string): TaskSessionState | undefined {
  return undefined
}

export function getWorkById(_stateOrDir: BoulderState | string, _workId: string): BoulderWorkState | undefined {
  return undefined
}

export function getWorkByPlanName(_stateOrDir: BoulderState | string, _planName: string, _options?: { worktreePath?: string }): BoulderWorkState | undefined {
  return undefined
}

export function getWorkForSession(_stateOrDir: BoulderState | string, _sessionId: string): BoulderWorkState | undefined {
  return undefined
}

export function getWorkResumeOptions(_stateOrDir: BoulderState | string): BoulderWorkResumeOption[] {
  return []
}

export function normalizeSessionId(_sessionId: string, _sourceOrUnused?: string): string {
  return _sessionId
}

export function readBoulderState(_directory: string): BoulderState | null {
  return null
}

export function resolveBoulderPlanPath(_directory: string, _stateOrPlan?: BoulderState | string): string {
  return ""
}

export function resolveBoulderPlanPathForWork(_directory: string, _work: BoulderWorkState): string {
  return ""
}

export function selectActiveWork(_stateOrDir: BoulderState | string, _workIdOrUnused?: string): BoulderWorkState | undefined {
  return undefined
}

export function startTaskTimer(_stateOrDir: BoulderState | string, _workIdOrTaskKey: string, _taskStateOrUnused?: Partial<TaskSessionState>): BoulderState {
  return { active_plan: "", started_at: new Date().toISOString(), session_ids: [], plan_name: "" }
}

export function upsertTaskSessionState(_stateOrDir: BoulderState | string, _sessionStateOrWorkId?: Partial<TaskSessionState> | string, _sessionStateUnused?: Partial<TaskSessionState>): BoulderState {
  return { active_plan: "", started_at: new Date().toISOString(), session_ids: [], plan_name: "" }
}

export function upsertTaskSessionStateForWork(_stateOrDir: BoulderState | string, _workIdOrSession?: string, _sessionStateOrUnused?: Partial<TaskSessionState> | string, _sessionStateUnused2?: Partial<TaskSessionState>): BoulderState {
  return { active_plan: "", started_at: new Date().toISOString(), session_ids: [], plan_name: "" }
}

export function writeBoulderState(_directory: string, _state: BoulderState): void {}

export function formatDurationHuman(_ms: number): string {
  return ""
}
