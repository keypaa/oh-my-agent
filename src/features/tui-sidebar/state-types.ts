export interface RosterRow {
  readonly name: string
  readonly category: string
  readonly status?: string
}

export interface SidebarView {
  readonly sidebar: { enabled: boolean }
}
