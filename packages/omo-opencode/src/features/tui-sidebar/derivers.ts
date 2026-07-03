import type { SidebarView } from "./state-types"

export function deriveAgents(_mirror: unknown): unknown[] {
  return []
}

export function deriveConfig(_validation: unknown): SidebarView {
  return { sidebar: { enabled: false } }
}

export function deriveJobBoard(_mirror: unknown): unknown[] {
  return []
}

export function deriveLoop(_mirror: unknown): unknown | null {
  return null
}

export function deriveRoster(_roster: unknown): unknown[] {
  return []
}
