import type { SidebarView } from "./state-types"

export const viewKey = "omo-sidebar"

export function computeView(_config: unknown): SidebarView {
  return { sidebar: { enabled: false } }
}
