export interface ViewNode {
  readonly kind: string
  readonly props: Record<string, unknown>
  readonly text?: string
  readonly children?: ViewNode[]
}
