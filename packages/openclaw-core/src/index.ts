export type OpenClawConfig = Record<string, unknown>
export type OpenClawGateway = { type?: string }
export type OpenClawHook = { enabled?: boolean; gateway?: string; instruction?: string }
export type OpenClawReplyListenerConfig = Record<string, unknown>
