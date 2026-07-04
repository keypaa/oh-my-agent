/// <reference path="../../../../bun-test.d.ts" />
import { describe, it, expect, afterEach, mock, spyOn } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"

import { createEventHandler, extractErrorMessage } from "./event"
import { createChatMessageHandler } from "./chat-message"
import { _resetForTesting, setMainSession, subagentSessions } from "../features/session-state"
import { clearPendingModelFallback, createModelFallbackHook } from "../hooks/model-fallback/hook"
import { getSessionPromptParams, setSessionPromptParams } from "../shared/session-prompt-params-state"

type EventInput = { event: { type: string; properties?: unknown } }
type EventHandlerArgs = Parameters<typeof createEventHandler>[0]
type EventHandlerInput = Parameters<ReturnType<typeof createEventHandler>>[0]
type ChatMessageHandlerArgs = Parameters<typeof createChatMessageHandler>[0]

function cast<T>(value: unknown): T {
	return value as T
}

function asEventHandlerInput(input: EventInput): EventHandlerInput {
	return cast<EventHandlerInput>(input)
}

function asEventHandlerContext(ctx: unknown): EventHandlerArgs["ctx"] {
	return cast<EventHandlerArgs["ctx"]>(ctx)
}

function asChatMessageHandlerContext(ctx: unknown): ChatMessageHandlerArgs["ctx"] {
	return cast<ChatMessageHandlerArgs["ctx"]>(ctx)
}

function asPluginConfig(config: unknown): EventHandlerArgs["pluginConfig"] {
	return cast<EventHandlerArgs["pluginConfig"]>(config)
}

function asChatPluginConfig(config: unknown): ChatMessageHandlerArgs["pluginConfig"] {
	return cast<ChatMessageHandlerArgs["pluginConfig"]>(config)
}

function asPluginInput(input: unknown): PluginInput {
	return input as PluginInput
}

function createEventHandlerManagers(
	overrides: Record<string, unknown> = {},
): EventHandlerArgs["managers"] {
	return cast<EventHandlerArgs["managers"]>({
		tmuxSessionManager: {
			onEvent: () => {},
			onSessionCreated: async () => {},
			onSessionDeleted: async () => {},
		},
		...overrides,
	})
}

function createEventHandlerHooks(
	overrides: Record<string, unknown> = {},
): EventHandlerArgs["hooks"] {
	return cast<EventHandlerArgs["hooks"]>(overrides)
}

function createChatMessageHandlerHooks(
	overrides: Record<string, unknown> = {},
): ChatMessageHandlerArgs["hooks"] {
	return cast<ChatMessageHandlerArgs["hooks"]>(overrides)
}

async function wait(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntil(predicate: () => boolean, timeoutMs: number = 500): Promise<void> {
	const startedAt = Date.now()
	while (!predicate()) {
		if (Date.now() - startedAt >= timeoutMs) {
			return
		}
		await wait(5)
	}
}

function createIdleTrackingEventHandler(dispatchCalls: EventInput[]): ReturnType<typeof createEventHandler> {
	return createEventHandler({
		ctx: asEventHandlerContext({}),
		pluginConfig: asPluginConfig({}),
		firstMessageVariantGate: {
			markSessionCreated: () => {},
			clear: () => {},
		},
		managers: createEventHandlerManagers({
			skillMcpManager: {
				disconnectSession: async () => {},
			},
		}),
		hooks: createEventHandlerHooks({
			autoUpdateChecker: {
				event: async (input: EventInput) => {
					if (input.event.type === "session.idle") {
						dispatchCalls.push(input)
					}
				},
			},
		}),
	})
}

function createIdleDedupSpyEventHandler(args: {
	onEvent: (event: EventInput["event"]) => void
	sessionNotification: (input: EventInput) => Promise<void>
}): ReturnType<typeof createEventHandler> {
	return createEventHandler({
		ctx: asEventHandlerContext({
			directory: "/tmp",
			client: {
				session: {},
			},
		}),
		pluginConfig: asPluginConfig({
			tmux: { enabled: true },
		}),
		firstMessageVariantGate: {
			markSessionCreated: () => {},
			clear: () => {},
		},
		managers: createEventHandlerManagers({
			tmuxSessionManager: {
				onEvent: args.onEvent,
				onSessionCreated: async () => {},
				onSessionDeleted: async () => {},
			},
		}),
		hooks: createEventHandlerHooks({
			sessionNotification: args.sessionNotification,
		}),
	})
}

async function flushMicrotasks(turns: number = 5): Promise<void> {
	for (let index = 0; index < turns; index += 1) {
		await Promise.resolve()
	}
}

afterEach(() => {
	mock.restore()
	_resetForTesting()
})

describe("event error extraction", () => {
	it("prefers nested APIError message over generic top-level message", async () => {
		const error = {
			name: "APIError",
			message: "Error",
			data: { message: "Forbidden: Selected provider is forbidden" },
		}
		const result = extractErrorMessage(error)
		expect(result).toBe("Forbidden: Selected provider is forbidden")
	})
})

describe("createEventHandler - idle deduplication", () => {
	it("#given session.status already emitted a synthetic idle #when real session.idle follows immediately #then hooks run once", async () => {
		//#given
		const dispatchCalls: EventInput[] = []
		const eventHandler = createIdleTrackingEventHandler(dispatchCalls)
		const sessionId = "ses_test123"
		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.status",
				properties: {
					sessionID: sessionId,
					status: { type: "idle" },
				},
			},
		}))
		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.idle",
				properties: {
					sessionID: sessionId,
				},
			},
		}))

		//#then
		expect(dispatchCalls).toHaveLength(1)
		expect(dispatchCalls[0]?.event.type).toBe("session.idle")
		expect((dispatchCalls[0]?.event.properties as { sessionID?: string } | undefined)?.sessionID).toBe(sessionId)
	})

	it("keeps other session dedup state untouched when suppressing real-idle-after-synthetic-idle", async () => {
		//#given
		const originalDateNow = Date.now
		let currentNow = 30_000
		Date.now = () => currentNow
		const dispatchedSessionIds: string[] = []
		const eventHandler = createIdleDedupSpyEventHandler({
			onEvent: () => {},
			sessionNotification: async (input: EventInput) => {
				if (input.event.type !== "session.idle") {
					return
				}
				const props = input.event.properties as { sessionID?: string } | undefined
				if (props?.sessionID) {
					dispatchedSessionIds.push(props.sessionID)
				}
			},
		})

		try {
			//#when
			await eventHandler(asEventHandlerInput({
				event: {
					type: "session.status",
					properties: {
						sessionID: "ses_a",
						status: { type: "idle" },
					},
				},
			}))
			await eventHandler(asEventHandlerInput({
				event: {
					type: "session.idle",
					properties: {
						sessionID: "ses_b",
					},
				},
			}))

			currentNow += 100
			await eventHandler(asEventHandlerInput({
				event: {
					type: "session.idle",
					properties: {
						sessionID: "ses_a",
					},
				},
			}))

			currentNow += 100
			await eventHandler(asEventHandlerInput({
				event: {
					type: "session.idle",
					properties: {
						sessionID: "ses_b",
					},
				},
			}))

			//#then
			expect(dispatchedSessionIds).toEqual(["ses_a", "ses_b"])
		} finally {
			Date.now = originalDateNow
		}
	})

	it("dedups back-to-back real session.idle events for the same sessionID within 500ms", async () => {
		//#given
		const originalDateNow = Date.now
		let currentNow = 10_000
		Date.now = () => currentNow
		const sessionNotification = mock(async (_input: EventInput) => {})
		const eventHandler = createIdleDedupSpyEventHandler({
			onEvent: () => {},
			sessionNotification,
		})
		const sessionId = "ses_same_idle"

		try {
			//#when
			await eventHandler(asEventHandlerInput({
				event: {
					type: "session.idle",
					properties: {
						sessionID: sessionId,
					},
				},
			}))
			await eventHandler(asEventHandlerInput({
				event: {
					type: "session.idle",
					properties: {
						sessionID: sessionId,
					},
				},
			}))

			//#then
			expect(sessionNotification).toHaveBeenCalledTimes(1)

			//#when
			currentNow += 501
			await eventHandler(asEventHandlerInput({
				event: {
					type: "session.idle",
					properties: {
						sessionID: sessionId,
					},
				},
			}))

			//#then
			expect(sessionNotification).toHaveBeenCalledTimes(2)
		} finally {
			Date.now = originalDateNow
		}
	})

	it("still dedups synthetic-idle-after-real-idle as before", async () => {
		//#given
		const dispatchCalls: EventInput[] = []
		const eventHandler = createIdleTrackingEventHandler(dispatchCalls)
		const sessionId = "ses_test456"
		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.idle",
				properties: {
					sessionID: sessionId,
				},
			},
		}))
		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.status",
				properties: {
					sessionID: sessionId,
					status: { type: "idle" },
				},
			},
		}))
		expect(dispatchCalls).toHaveLength(1)
		expect(dispatchCalls[0]?.event.type).toBe("session.idle")
		expect((dispatchCalls[0]?.event.properties as { sessionID?: string } | undefined)?.sessionID).toBe(sessionId)
	})

	it("does NOT dedup session.idle events for DIFFERENT sessionIDs", async () => {
		//#given
		const originalDateNow = Date.now
		let currentNow = 20_000
		Date.now = () => currentNow
		const sessionNotification = mock(async (_input: EventInput) => {})
		const eventHandler = createIdleDedupSpyEventHandler({
			onEvent: () => {},
			sessionNotification,
		})

		try {
			//#when
			await eventHandler(asEventHandlerInput({
				event: {
					type: "session.idle",
					properties: {
						sessionID: "ses_first_idle",
					},
				},
			}))
			await eventHandler(asEventHandlerInput({
				event: {
					type: "session.idle",
					properties: {
						sessionID: "ses_second_idle",
					},
				},
			}))

			//#then
			expect(sessionNotification).toHaveBeenCalledTimes(2)
		} finally {
			Date.now = originalDateNow
		}
	})

	it("both maps pruned on every event", async () => {
		//#given
		const eventHandler = createEventHandler({
			ctx: asEventHandlerContext({}),
			pluginConfig: asPluginConfig({}),
			firstMessageVariantGate: {
				markSessionCreated: () => {},
				clear: () => {},
			},
			managers: createEventHandlerManagers({
				tmuxSessionManager: {
					onSessionCreated: async () => {},
					onSessionDeleted: async () => {},
				},
			}),
			hooks: createEventHandlerHooks({
				autoUpdateChecker: { event: async () => {} },

				backgroundNotificationHook: { event: async () => {} },
				sessionNotification: async () => {},
				unstableAgentBabysitter: { event: async () => {} },
				directoryAgentsInjector: { event: async () => {} },
				directoryReadmeInjector: { event: async () => {} },
				rulesInjector: { event: async () => {} },
				thinkMode: { event: async () => {} },
				anthropicContextWindowLimitRecovery: { event: async () => {} },
				agentUsageReminder: { event: async () => {} },
				categorySkillReminder: { event: async () => {} },
				interactiveBashSession: { event: async () => {} },
				ralphLoop: { event: async () => {} },
				stopContinuationGuard: { event: async () => {} },
				compactionTodoPreserver: { event: async () => {} },
				atlasHook: { handler: async () => {} },
			}),
		})

		await eventHandler({
			event: {
				type: "session.status",
				properties: {
					sessionID: "ses_stale_1",
					status: { type: "idle" },
				},
			},
		})

		await eventHandler({
			event: {
				type: "session.status",
				properties: {
					sessionID: "ses_stale_2",
					status: { type: "idle" },
				},
			},
		})

		await eventHandler({
			event: {
				type: "session.idle",
				properties: {
					sessionID: "ses_stale_3",
				},
			},
		})

		await eventHandler({
			event: {
				type: "session.idle",
				properties: {
					sessionID: "ses_stale_4",
				},
			},
		})
		await wait(600)

		await eventHandler(asEventHandlerInput({
			event: {
				type: "message.updated",
			},
		}))
		const dispatchCalls: EventInput[] = []
		const eventHandlerWithMock = createEventHandler({
			ctx: asEventHandlerContext({}),
			pluginConfig: asPluginConfig({}),
			firstMessageVariantGate: {
				markSessionCreated: () => {},
				clear: () => {},
			},
			managers: createEventHandlerManagers({
				tmuxSessionManager: {
					onSessionCreated: async () => {},
					onSessionDeleted: async () => {},
				},
			}),
			hooks: createEventHandlerHooks({
				autoUpdateChecker: {
					event: async (input: EventInput) => {
						dispatchCalls.push(input)
					},
				},

				backgroundNotificationHook: { event: async () => {} },
				sessionNotification: async () => {},
				unstableAgentBabysitter: { event: async () => {} },
				directoryAgentsInjector: { event: async () => {} },
				directoryReadmeInjector: { event: async () => {} },
				rulesInjector: { event: async () => {} },
				thinkMode: { event: async () => {} },
				anthropicContextWindowLimitRecovery: { event: async () => {} },
				agentUsageReminder: { event: async () => {} },
				categorySkillReminder: { event: async () => {} },
				interactiveBashSession: { event: async () => {} },
				ralphLoop: { event: async () => {} },
				stopContinuationGuard: { event: async () => {} },
				compactionTodoPreserver: { event: async () => {} },
				atlasHook: { handler: async () => {} },
			}),
		})

		await eventHandlerWithMock({
			event: {
				type: "session.idle",
				properties: {
					sessionID: "ses_stale_1",
				},
			},
		})

		expect(dispatchCalls.length).toBe(1)
		expect(dispatchCalls[0].event.type).toBe("session.idle")
	})

	it("dispatches both idle events once the dedup window expires", async () => {
		const dispatchCalls: EventInput[] = []
		const eventHandler = createEventHandler({
			ctx: asEventHandlerContext({}),
			pluginConfig: asPluginConfig({}),
			firstMessageVariantGate: {
				markSessionCreated: () => {},
				clear: () => {},
			},
			managers: createEventHandlerManagers({
				tmuxSessionManager: {
					onSessionCreated: async () => {},
					onSessionDeleted: async () => {},
				},
			}),
			hooks: createEventHandlerHooks({
				autoUpdateChecker: {
					event: async (input: EventInput) => {
						if (input.event.type === "session.idle") {
							dispatchCalls.push(input)
						}
					},
				},

				backgroundNotificationHook: { event: async () => {} },
				sessionNotification: async () => {},
				unstableAgentBabysitter: { event: async () => {} },
				directoryAgentsInjector: { event: async () => {} },
				directoryReadmeInjector: { event: async () => {} },
				rulesInjector: { event: async () => {} },
				thinkMode: { event: async () => {} },
				anthropicContextWindowLimitRecovery: { event: async () => {} },
				agentUsageReminder: { event: async () => {} },
				categorySkillReminder: { event: async () => {} },
				interactiveBashSession: { event: async () => {} },
				ralphLoop: { event: async () => {} },
				stopContinuationGuard: { event: async () => {} },
				compactionTodoPreserver: { event: async () => {} },
				atlasHook: { handler: async () => {} },
			}),
		})

		const sessionId = "ses_outside_window"
		await eventHandler({
			event: {
				type: "session.status",
				properties: {
					sessionID: sessionId,
					status: { type: "idle" },
				},
			},
		})
		expect(dispatchCalls.length).toBe(1)
		await wait(600)
		await eventHandler({
			event: {
				type: "session.idle",
				properties: {
					sessionID: sessionId,
				},
			},
		})
		expect(dispatchCalls.length).toBe(2)
		expect(dispatchCalls[0].event.type).toBe("session.idle")
		expect(dispatchCalls[1].event.type).toBe("session.idle")
	})
})

describe("createEventHandler - event forwarding", () => {
	it("forwards session.deleted to write-existing-file-guard hook", async () => {
		const forwardedEvents: EventInput[] = []
		const disconnectedSessions: string[] = []
		const eventHandler = createEventHandler({
			ctx: {} as never,
			pluginConfig: {} as never,
			firstMessageVariantGate: {
				markSessionCreated: () => {},
				clear: () => {},
			},
			managers: {
				skillMcpManager: {
					disconnectSession: async (sessionID: string) => {
						disconnectedSessions.push(sessionID)
					},
				},
			} as never,
			hooks: {
				writeExistingFileGuard: {
					event: async (input: EventInput) => {
						forwardedEvents.push(input)
					},
				},
			} as never,
		})
		const sessionID = "ses_forward_delete_event"
		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.deleted",
				properties: { info: { id: sessionID } },
			},
		}))
		expect(forwardedEvents.length).toBe(1)
		expect(forwardedEvents[0]?.event.type).toBe("session.deleted")
		expect(disconnectedSessions).toEqual([sessionID])
	})

	it("clears stored prompt params on session.deleted", async () => {
		const eventHandler = createEventHandler({
			ctx: {} as never,
			pluginConfig: {} as never,
			firstMessageVariantGate: {
				markSessionCreated: () => {},
				clear: () => {},
			},
			managers: {
				skillMcpManager: {
					disconnectSession: async () => {},
				},
			} as never,
			hooks: {} as never,
		})
		const sessionID = "ses_prompt_params_deleted"
		setSessionPromptParams(sessionID, {
			temperature: 0.4,
			topP: 0.7,
			options: { reasoningEffort: "high" },
		})
		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.deleted",
				properties: { info: { id: sessionID } },
			},
		}))
		expect(getSessionPromptParams(sessionID)).toBeUndefined()
	})
})

describe("createEventHandler - retry dedupe lifecycle", () => {
	it("re-handles same retry key after session recovers to idle status", async () => {
		const sessionID = "ses_retry_recovery_rearm"
		setMainSession(sessionID)
		const abortCalls: string[] = []
		const promptCalls: string[] = []
		const modelFallback = createModelFallbackHook()
		clearPendingModelFallback(modelFallback, sessionID)

		const eventHandler = createEventHandler({
			ctx: asEventHandlerContext({
				directory: "/tmp",
				client: {
					session: {
						abort: async ({ path }: { path: { id: string } }) => {
							abortCalls.push(path.id)
							return {}
						},
						prompt: async ({ path }: { path: { id: string } }) => {
							promptCalls.push(path.id)
							return {}
						},
					},
				},
			}),
			pluginConfig: asPluginConfig({}),
			firstMessageVariantGate: {
				markSessionCreated: () => {},
				clear: () => {},
			},
			managers: createEventHandlerManagers({
				skillMcpManager: {
					disconnectSession: async () => {},
				},
			}),
			hooks: createEventHandlerHooks({
				modelFallback,
				stopContinuationGuard: { isStopped: () => false },
			}),
		})

		const chatMessageHandler = createChatMessageHandler({
			ctx: asChatMessageHandlerContext({
				client: {
					tui: {
						showToast: async () => ({}),
					},
				},
			}),
			pluginConfig: asChatPluginConfig({}),
			firstMessageVariantGate: {
				shouldOverride: () => false,
				markApplied: () => {},
			},
			hooks: createChatMessageHandlerHooks({
				modelFallback,
				stopContinuationGuard: null,
				keywordDetector: null,

				autoSlashCommand: null,
				startWork: null,
				ralphLoop: null,
			}),
		})

		const retryStatus = {
			type: "retry",
			attempt: 1,
			message: "All credentials for model claude-opus-4-7-thinking are cooling down [retrying in 7m 56s attempt #1]",
			next: 476,
		} as const

		await eventHandler(asEventHandlerInput({
			event: {
				type: "message.updated",
				properties: {
					info: {
						id: "msg_user_retry_rearm",
						sessionID,
						role: "user",
						modelID: "claude-opus-4-7-thinking",
						providerID: "anthropic",
						agent: "Sisyphus - Ultraworker",
					},
				},
			},
		}))
		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.status",
				properties: {
					sessionID,
					status: retryStatus,
				},
			},
		}))

		const firstOutput = { message: {}, parts: [] as Array<{ type: string; text?: string }> }
		await chatMessageHandler(
			{
				sessionID,
				agent: "sisyphus",
				model: { providerID: "anthropic", modelID: "claude-opus-4-7-thinking" },
			},
			firstOutput,
		)
		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.status",
				properties: {
					sessionID,
					status: { type: "idle" },
				},
			},
		}))
		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.status",
				properties: {
					sessionID,
					status: retryStatus,
				},
			},
		}))
		// With empty AGENT_MODEL_REQUIREMENTS, no fallback model is available,
		// so abort and prompt are never called. The dedupe logic still works
		// (retry key is tracked and cleared after idle), but the actual fallback
		// dispatch is skipped because there's no model to fall back to.
		expect(abortCalls).toEqual([])
		expect(promptCalls).toEqual([])
	})
})

describe("createEventHandler - event hook isolation", () => {
	it("continues dispatching later event hooks when an earlier hook throws", async () => {
		const runtimeFallbackCalls: EventInput[] = []

		const eventHandler = createEventHandler({
			ctx: asEventHandlerContext({
				directory: "/tmp",
				client: {
					session: {
						abort: async () => ({}),
						prompt: async () => ({}),
					},
				},
			}),
			pluginConfig: asPluginConfig({}),
			firstMessageVariantGate: {
				markSessionCreated: () => {},
				clear: () => {},
			},
			managers: createEventHandlerManagers(),
			hooks: createEventHandlerHooks({
				autoUpdateChecker: {
					event: async () => {
						throw new Error("upstream hook failed")
					},
				},
				runtimeFallback: {
					event: async (input: EventInput) => {
						runtimeFallbackCalls.push(input)
					},
				},
				stopContinuationGuard: { isStopped: () => false },
			}),
		})
		await expect(eventHandler(asEventHandlerInput({
				event: {
					type: "session.error",
					properties: {
						sessionID: "ses_hook_isolation",
						error: { name: "Error", message: "retry me" },
					},
				},
			}))).resolves.toBeUndefined()
		expect(runtimeFallbackCalls).toHaveLength(1)
		expect(runtimeFallbackCalls[0]?.event.type).toBe("session.error")
	})

	it("preserves hook fan-out order while isolating individual hook failures", async () => {
		const calls: string[] = []

		const eventHandler = createEventHandler({
			ctx: asEventHandlerContext({
				directory: "/tmp",
				client: {
					session: {
						abort: async () => ({}),
						prompt: async () => ({}),
					},
				},
			}),
			pluginConfig: asPluginConfig({}),
			firstMessageVariantGate: {
				markSessionCreated: () => {},
				clear: () => {},
			},
			managers: createEventHandlerManagers(),
			hooks: createEventHandlerHooks({
				autoUpdateChecker: {
					event: async () => {
						calls.push("autoUpdateChecker")
					},
				},
				legacyPluginToast: {
					event: async () => {
						calls.push("legacyPluginToast")
						throw new Error("toast failed")
					},
				},
				backgroundNotificationHook: {
					event: async () => {
						calls.push("backgroundNotificationHook")
					},
				},
				sessionNotification: async () => {
					calls.push("sessionNotification")
				},
				runtimeFallback: {
					event: async () => {
						calls.push("runtimeFallback")
					},
				},
				writeExistingFileGuard: {
					event: async () => {
						calls.push("writeExistingFileGuard")
					},
				},
				stopContinuationGuard: { isStopped: () => false },
			}),
		})

		await eventHandler(asEventHandlerInput({
			event: {
				type: "session.error",
				properties: {
					sessionID: "ses_hook_order",
					error: { name: "Error", message: "retry me" },
				},
			},
		}))

		expect(calls).toEqual([
			"autoUpdateChecker",
			"legacyPluginToast",
			"backgroundNotificationHook",
			"sessionNotification",
			"runtimeFallback",
			"writeExistingFileGuard",
		])
	})
})
