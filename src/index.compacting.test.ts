import { describe, expect, it, mock } from "bun:test"

import {
  createCompactionAutocontinueHandler,
  createSessionCompactingHandler,
} from "./plugin/session-compacting"

describe("experimental.session.compacting handler", () => {
  //#given claudeCodeHooks is null (no claude code hooks configured)
  //#when compacting handler is invoked
  //#then handler completes without error and other hooks still run
  it("handles null claudeCodeHooks gracefully", async () => {
    const captureMock = mock(async () => {})
    const checkpointCaptureMock = mock(async () => {})
    const contextMock = mock(() => "injected-context")

    const handler = createSessionCompactingHandler({
      compactionContextInjector: {
        capture: checkpointCaptureMock,
        inject: contextMock,
      },
      compactionTodoPreserver: { capture: captureMock },
    })

    const output = { context: [] as string[], prompt: undefined as string | undefined }
    await handler({ sessionID: "ses_test" }, output)

    expect(checkpointCaptureMock).toHaveBeenCalledWith("ses_test")
    expect(captureMock).toHaveBeenCalledWith("ses_test")
    expect(contextMock).toHaveBeenCalledWith("ses_test")
    expect(output.context).toEqual(["injected-context"])
  })
})

describe("experimental.compaction.autocontinue handler", () => {
  it("disables OpenCode autocontinue when the compaction agent would continue itself", async () => {
    //#given
    const restoreContextMock = mock(async () => true)
    const restoreTodosMock = mock(async () => {})
    const handler = createCompactionAutocontinueHandler({
      compactionContextInjector: { restore: restoreContextMock },
      compactionTodoPreserver: { restore: restoreTodosMock },
    })
    const output = { enabled: true }

    //#when
    await handler({ sessionID: "ses_compaction_loop", agent: "compaction" }, output)

    //#then
    expect(output.enabled).toBe(false)
    expect(restoreContextMock).not.toHaveBeenCalled()
    expect(restoreTodosMock).not.toHaveBeenCalled()
  })

  it("restores checkpointed context and todos before OpenCode adds the synthetic continue turn", async () => {
    //#given
    const callOrder: string[] = []
    const restoreContextMock = mock(async () => {
      callOrder.push("context")
      return true
    })
    const restoreMock = mock(async () => {})
    const handler = createCompactionAutocontinueHandler({
      compactionContextInjector: { restore: restoreContextMock },
      compactionTodoPreserver: {
        restore: mock(async (sessionID: string) => {
          callOrder.push(`todos:${sessionID}`)
          await restoreMock(sessionID)
        }),
      },
    })
    const output = { enabled: true }

    //#when
    await handler({ sessionID: "ses_autocontinue" }, output)

    //#then
    expect(restoreContextMock).toHaveBeenCalledWith("ses_autocontinue")
    expect(restoreMock).toHaveBeenCalledWith("ses_autocontinue")
    expect(callOrder).toEqual(["context", "todos:ses_autocontinue"])
    expect(output.enabled).toBe(true)
  })

  it("continues autocontinue restore when one restore hook throws", async () => {
    //#given
    const restoreMock = mock(async () => {})
    const handler = createCompactionAutocontinueHandler({
      compactionContextInjector: {
        restore: mock(async () => {
          throw new Error("checkpoint restore failed")
        }),
      },
      compactionTodoPreserver: { restore: restoreMock },
    })
    const output = { enabled: true }

    //#when
    await expect(handler({ sessionID: "ses_autocontinue" }, output)).resolves.toBeUndefined()

    //#then
    expect(restoreMock).toHaveBeenCalledWith("ses_autocontinue")
    expect(output.enabled).toBe(true)
  })

  it("suppresses a duplicate same-session autocontinue in the guard window", async () => {
    //#given
    const restoreContextMock = mock(async () => true)
    const restoreTodosMock = mock(async () => {})
    const handler = createCompactionAutocontinueHandler(
      {
        compactionContextInjector: { restore: restoreContextMock },
        compactionTodoPreserver: { restore: restoreTodosMock },
      },
      { duplicateGuardMs: 25 },
    )
    const firstOutput = { enabled: true }
    const duplicateOutput = { enabled: true }

    //#when
    await handler({ sessionID: "ses_duplicate_autocontinue" }, firstOutput)
    await handler({ sessionID: "ses_duplicate_autocontinue" }, duplicateOutput)

    //#then
    expect(firstOutput.enabled).toBe(true)
    expect(duplicateOutput.enabled).toBe(false)
    expect(restoreContextMock).toHaveBeenCalledTimes(1)
    expect(restoreTodosMock).toHaveBeenCalledTimes(1)
  })

  it("allows same-session autocontinue after the duplicate guard window expires", async () => {
    //#given
    const restoreContextMock = mock(async () => true)
    const restoreTodosMock = mock(async () => {})
    const handler = createCompactionAutocontinueHandler(
      {
        compactionContextInjector: { restore: restoreContextMock },
        compactionTodoPreserver: { restore: restoreTodosMock },
      },
      { duplicateGuardMs: 1 },
    )
    const firstOutput = { enabled: true }
    const laterOutput = { enabled: true }

    //#when
    await handler({ sessionID: "ses_guard_expired" }, firstOutput)
    await new Promise((resolve) => setTimeout(resolve, 10))
    await handler({ sessionID: "ses_guard_expired" }, laterOutput)

    //#then
    expect(firstOutput.enabled).toBe(true)
    expect(laterOutput.enabled).toBe(true)
    expect(restoreContextMock).toHaveBeenCalledTimes(2)
    expect(restoreTodosMock).toHaveBeenCalledTimes(2)
  })
})
