import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unsafeTestValue } from "../../../test-support/unsafe-test-value"
import { releaseAllPromptAsyncReservationsForTesting } from "../../shared/prompt-async-gate"
import type { OhMyOpenCodeConfig } from "../../config"
import type { AuditLoopHook, AuditLoopState } from "./types"

type AuditLoopModule = typeof import("./audit-loop-hook")

describe("audit-loop-hook", () => {
  let createAuditLoopHook: AuditLoopModule["createAuditLoopHook"]

  beforeEach(async () => {
    releaseAllPromptAsyncReservationsForTesting()
    process.env.OMA_AUDIT_POLL_INTERVAL_MS = "50"

    const mod: AuditLoopModule = await import("./audit-loop-hook")
    createAuditLoopHook = mod.createAuditLoopHook
  })

  afterEach(() => {
    delete process.env.OMA_AUDIT_POLL_INTERVAL_MS
    releaseAllPromptAsyncReservationsForTesting()
  })

  let promptAsyncCallCount: number

  function createMockPluginInput(overrides?: {
    sessionMessages?: (args: unknown) => Promise<unknown>
    sessions?: Record<string, { messages: unknown[] }>
    promptAsync?: (args: unknown) => Promise<unknown>
  }) {
    promptAsyncCallCount = 0
    return unsafeTestValue<{
      client: {
        session: {
          messages: (args: unknown) => Promise<unknown>
          promptAsync: (args: unknown) => Promise<unknown>
          prompt: (args: unknown) => Promise<unknown>
        }
      }
      directory: string
    }>({
      client: {
        session: {
          messages: overrides?.sessions
            ? async (args: unknown) => {
                const id = (args as { path?: { id?: string } })?.path?.id
                const session = overrides.sessions![id ?? ""]
                return { data: session?.messages ?? [] }
              }
            : overrides?.sessionMessages ??
              (async () => ({
                data: [],
              })),
          promptAsync: overrides?.promptAsync
            ?? (async () => {
              promptAsyncCallCount++
              const sessionID = promptAsyncCallCount === 1
                ? "verifier-session-1"
                : `verifier-session-${promptAsyncCallCount}`
              return { sessionID }
            }),
          prompt: overrides?.promptAsync
            ?? (async () => {
              promptAsyncCallCount++
              const sessionID = promptAsyncCallCount === 1
                ? "verifier-session-1"
                : `verifier-session-${promptAsyncCallCount}`
              return { sessionID }
            }),
        },
      },
      directory: "/test/dir",
    })
  }

  function createMockConfig(overrides?: Record<string, unknown>): OhMyOpenCodeConfig {
    return {
      audit_loop: {
        enabled: true,
        max_cycles: 3,
        skip_verifier_2: false,
        ...overrides,
      },
    } as OhMyOpenCodeConfig
  }

  describe("startAudit", () => {
    test("should initialize state correctly and return true", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      const result = hook.startAudit("session-123", {
        originalTask: "Implement feature X",
        agentClaims: "I have completed the task",
        changedFiles: "src/feature.ts",
        plan: "Step 1: do thing",
      })

      expect(result).toBe(true)
      const state = hook.getState() as AuditLoopState
      expect(state).not.toBeNull()
      expect(state.active).toBe(true)
      expect(state.sessionID).toBe("session-123")
      expect(state.cycleCount).toBe(0)
      expect(state.maxCycles).toBe(3)
      expect(state.originalTask).toBe("Implement feature X")
      expect(state.agentClaims).toBe("I have completed the task")
      expect(state.changedFiles).toBe("src/feature.ts")
      expect(state.plan).toBe("Step 1: do thing")
      expect(state.startedAt).toBeTruthy()
    })

    test("should return false when audit loop is disabled", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig({ enabled: false })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      const result = hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      expect(result).toBe(false)
      expect(hook.getState()).toBeNull()
    })

    test("should return false when audit is already active", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-1", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      const result = hook.startAudit("session-2", {
        originalTask: "other task",
        agentClaims: "other claims",
        changedFiles: "other files",
      })

      expect(result).toBe(false)
      expect(hook.getState()?.sessionID).toBe("session-1")
    })

    test("should use custom max_cycles from config", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig({ max_cycles: 5 })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      expect(hook.getState()?.maxCycles).toBe(5)
    })

    test("should default max_cycles to 3 when not configured", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig({ max_cycles: undefined })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      expect(hook.getState()?.maxCycles).toBe(3)
    })
  })

  describe("cancelAudit", () => {
    test("should return false when no active audit", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      const result = hook.cancelAudit()

      expect(result).toBe(false)
    })

    test("should cancel active audit and return true", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      const result = hook.cancelAudit()

      expect(result).toBe(true)
      expect(hook.getState()?.active).toBe(false)
    })
  })

  describe("event handler", () => {
    test("should ignore non-idle events", async () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      await hook.event({
        event: { type: "session.created", properties: { sessionID: "session-123" } },
      })

      expect(hook.getState()?.active).toBe(true)
    })

    test("should ignore idle events when audit is not started", async () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      expect(hook.getState()).toBeNull()
    })

    test("should ignore idle events when audit is disabled", async () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig({ enabled: false })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      expect(hook.getState()).toBeNull()
    })

    test("should ignore idle events for different session", async () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "different-session" } },
      })

      expect(hook.getState()?.active).toBe(true)
      expect(hook.getState()?.cycleCount).toBe(0)
    })

    test("should ignore idle events when event has no sessionID", async () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      await hook.event({
        event: { type: "session.idle", properties: {} },
      })

      expect(hook.getState()?.active).toBe(true)
      expect(hook.getState()?.cycleCount).toBe(0)
    })
  })

  describe("detectCompletionClaim (tested via event method)", () => {
    function makeSessions(mainText: string, verdictText?: string) {
      return {
        "session-123": {
          messages: [{ info: { role: "assistant" }, parts: [{ type: "text", text: mainText }] }],
        },
        "verifier-session-1": {
          messages: [
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: verdictText ?? "## Summary\nAll code looks correct.\n\nVERDICT: [APPROVE]" }],
            },
          ],
        },
      }
    }

    test("should detect 'done' in assistant message", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("I am done with the implementation.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should detect 'completed' in assistant message", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("The task is completed.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should detect 'finished' in assistant message", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("All done, finished the work.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should detect 'all tasks complete' in assistant message", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("All tasks are complete.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should detect 'everything is done' in assistant message", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("Everything is done and working.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should detect 'work is complete' in assistant message", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("The work is complete.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should detect 'implementation is done' in assistant message", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("The implementation is done.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should trigger on 'are all tasks complete?' because regex has no word boundary", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("Are all tasks complete? Let me check.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should trigger on 'I'm not done yet' because 'done' is a substring match", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("I'm not done yet, still working.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should NOT trigger when only user messages contain completion words", async () => {
      const ctx = createMockPluginInput({
        sessions: {
          "session-123": {
            messages: [{ info: { role: "user" }, parts: [{ type: "text", text: "Are you done?" }] }],
          },
        },
      })
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      expect(hook.getState()?.cycleCount).toBe(0)
      expect(hook.getState()?.active).toBe(true)
    })

    test("should NOT trigger when assistant message has no text parts", async () => {
      const ctx = createMockPluginInput({
        sessions: {
          "session-123": {
            messages: [{ info: { role: "assistant" }, parts: [{ type: "thinking", text: "deep thought" }] }],
          },
        },
      })
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      expect(hook.getState()?.cycleCount).toBe(0)
      expect(hook.getState()?.active).toBe(true)
    })

    test("should detect 'all todos are finished' in assistant message", async () => {
      const ctx = createMockPluginInput({ sessions: makeSessions("All todos are finished and verified.") })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", { originalTask: "task", agentClaims: "claims", changedFiles: "files" })

      await hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })
  })

  describe("parseVerifierVerdict (tested via event method)", () => {
    test("should parse APPROVE verdict and deactivate audit", async () => {
      const ctx = createMockPluginInput({
        sessions: {
          "session-123": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "All done" }],
              },
            ],
          },
          "verifier-session-1": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [
                  {
                    type: "text",
                    text: "## Summary\nAll code looks correct and matches the spec.\n\nVERDICT: [APPROVE]",
                  },
                ],
              },
            ],
          },
        },
      })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should parse REJECT verdict and keep audit active", async () => {
      const ctx = createMockPluginInput({
        sessions: {
          "session-123": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "All done" }],
              },
            ],
          },
          "verifier-session-1": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [
                  {
                    type: "text",
                    text: "## Summary\nCode has issues.\n\n### Blocking Issues\n1. Missing error handling\n2. No tests\n\nVERDICT: [REJECT]\n",
                  },
                ],
              },
            ],
          },
        },
      })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(true)
      expect(state.cycleCount).toBe(1)
    })

    test("should parse malformed verdict as not approved and keep audit active", async () => {
      const ctx = createMockPluginInput({
        sessions: {
          "session-123": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "All done" }],
              },
            ],
          },
          "verifier-session-1": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "I looked at the code but forgot to include a verdict." }],
              },
            ],
          },
        },
      })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(true)
      expect(state.cycleCount).toBe(1)
    })

    test("should handle verifier returning no output", async () => {
      const ctx = createMockPluginInput({
        sessions: {
          "session-123": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "All done" }],
              },
            ],
          },
          "verifier-session-1": {
            messages: [
              {
                info: { role: "user" },
                parts: [{ type: "text", text: "Please review" }],
              },
            ],
          },
        },
      })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      const state = hook.getState() as AuditLoopState
      expect(state.cycleCount).toBe(1)
      expect(state.active).toBe(true)
    }, 65000)
  })

  describe("circuit breaker", () => {
    test("should use default maxCycles of 3 when not configured", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig({ max_cycles: undefined })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      expect(hook.getState()?.maxCycles).toBe(3)
    })
  })

  describe("processAuditLoop", () => {
    test("should do nothing when state is null", async () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      expect(hook.getState()).toBeNull()
    })

    test("should not re-enter while processing same session", async () => {
      const ctx = createMockPluginInput({
        sessions: {
          "session-123": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "Still working" }],
              },
            ],
          },
          "verifier-session-1": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "All done" }],
              },
            ],
          },
        },
      })
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      const p1 = hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })
      const p2 = hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      await new Promise((r) => setTimeout(r, 50))

      expect(hook.getState()?.cycleCount).toBeLessThanOrEqual(1)

      await Promise.allSettled([p1, p2])
    })

    test("happy path: completion detected -> auditor approves -> audit deactivated", async () => {
      const ctx = createMockPluginInput({
        sessions: {
          "session-123": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "All done with the implementation." }],
              },
            ],
          },
          "verifier-session-1": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [
                  {
                    type: "text",
                    text: "## Summary\nEverything looks good.\n\nVERDICT: [APPROVE]",
                  },
                ],
              },
            ],
          },
        },
      })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "Build feature X",
        agentClaims: "I implemented feature X",
        changedFiles: "src/feature.ts",
      })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      const state = hook.getState() as AuditLoopState
      expect(state.active).toBe(false)
      expect(state.cycleCount).toBe(1)
    })

    test("should handle The-Auditor spawn failure gracefully", async () => {
      let callCount = 0
      const ctx = createMockPluginInput({
        promptAsync: async () => {
          callCount++
          if (callCount === 1) {
            throw new Error("dispatch timeout")
          }
          return {}
        },
        sessions: {
          "session-123": {
            messages: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "Done!" }],
              },
            ],
          },
        },
      })
      const config = createMockConfig({ skip_verifier_2: true })
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      await hook.event({
        event: { type: "session.idle", properties: { sessionID: "session-123" } },
      })

      const state = hook.getState() as AuditLoopState
      expect(state.cycleCount).toBe(1)
      expect(state.active).toBe(true)
    })
  })

  describe("inFlightSessions deduplication", () => {
    test("should process session only once even with rapid idle events", async () => {
      let processCount = 0
      const ctx = createMockPluginInput({
        sessionMessages: async () => {
          processCount++
          return {
            data: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "Still working" }],
              },
            ],
          }
        },
      })
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })
      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      await Promise.all([
        hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } }),
        hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } }),
        hook.event({ event: { type: "session.idle", properties: { sessionID: "session-123" } } }),
      ])

      expect(processCount).toBe(1)
    })
  })

  describe("getState", () => {
    test("should return null when no audit started", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      expect(hook.getState()).toBeNull()
    })

    test("should return state after startAudit", () => {
      const ctx = createMockPluginInput()
      const config = createMockConfig()
      const hook = createAuditLoopHook(ctx, { pluginConfig: config, directory: "/test/dir" })

      hook.startAudit("session-123", {
        originalTask: "task",
        agentClaims: "claims",
        changedFiles: "files",
      })

      const state = hook.getState()
      expect(state).not.toBeNull()
      expect(state?.active).toBe(true)
    })
  })
})
