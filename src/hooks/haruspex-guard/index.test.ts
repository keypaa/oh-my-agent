import { describe, expect, test, beforeEach } from "bun:test"
import { createHaruspexGuardHook } from "./index"
import { updateSessionAgent, clearSessionAgent, _resetForTesting } from "../../features/session-state"
import type { HaruspexGuardConfig } from "../../config/schema/haruspex-guard"

const DEFAULT_CONFIG: HaruspexGuardConfig = {
  enabled: true,
  allowed_paths: ["src/agents/**", "src/hooks/**", "*.md"],
  denied_paths: ["src/plugin/**", "package.json"],
  require_confirmation: ["src/agents/builtin-agents.ts"],
  show_diff: false,
}

type Hook = ReturnType<typeof createHaruspexGuardHook>

function createHook(overrides?: Partial<HaruspexGuardConfig>): Hook {
  return createHaruspexGuardHook(
    { directory: "/test", client: undefined } as never,
    { ...DEFAULT_CONFIG, ...overrides },
  )
}

describe("createHaruspexGuardHook", () => {
  beforeEach(() => {
    _resetForTesting()
  })

  describe("#given enabled hook", () => {
    test("#when non-Haruspex agent #then allows write to denied path", async () => {
      updateSessionAgent("test", "Sisyphus")
      const hook = createHook()
      await hook["tool.execute.before"](
        { tool: "write", sessionID: "test", callID: "c1" },
        { args: { filePath: "src/plugin/index.ts", content: "new" } },
      )
    })

    test("#when Haruspex agent writing to denied path #then blocks", async () => {
      updateSessionAgent("test", "Haruspex")
      const hook = createHook()
      let caughtMessage = ""
      try {
        await hook["tool.execute.before"](
          { tool: "write", sessionID: "test", callID: "c1" },
          { args: { filePath: "src/plugin/index.ts", content: "new" } },
        )
      } catch (err) {
        if (err instanceof Error) caughtMessage = err.message
        else throw err
      }
      expect(caughtMessage).toContain("not allowed to modify")
      expect(caughtMessage).toContain("src/plugin/index.ts")
    })

    test("#when Haruspex agent writing to allowed path #then allows", async () => {
      updateSessionAgent("test", "Haruspex")
      const hook = createHook()
      await hook["tool.execute.before"](
        { tool: "write", sessionID: "test", callID: "c1" },
        { args: { filePath: "src/agents/new-agent.ts", content: "export {}" } },
      )
    })

    test("#when Haruspex agent writing to confirmation path #then allows with warning", async () => {
      updateSessionAgent("test", "Haruspex")
      const hook = createHook()
      await hook["tool.execute.before"](
        { tool: "write", sessionID: "test", callID: "c1" },
        { args: { filePath: "src/agents/builtin-agents.ts", content: "updated" } },
      )
    })

    test("#when edit tool on denied path #then blocks", async () => {
      updateSessionAgent("test", "Haruspex")
      const hook = createHook()
      let caughtMessage = ""
      try {
        await hook["tool.execute.before"](
          { tool: "edit", sessionID: "test", callID: "c1" },
          { args: { filePath: "src/shared/utils.ts", newText: "changed" } },
        )
      } catch (err) {
        if (err instanceof Error) caughtMessage = err.message
        else throw err
      }
      expect(caughtMessage).toContain("not allowed to modify")
    })

    test("#when apply_patch on denied path #then blocks", async () => {
      updateSessionAgent("test", "Haruspex")
      const hook = createHook()
      let caughtMessage = ""
      try {
        await hook["tool.execute.before"](
          { tool: "apply_patch", sessionID: "test", callID: "c1" },
          { args: { filePath: "package.json", content: "{}" } },
        )
      } catch (err) {
        if (err instanceof Error) caughtMessage = err.message
        else throw err
      }
      expect(caughtMessage).toContain("not allowed to modify")
    })

    test("#when non-write tool #then no interception", async () => {
      updateSessionAgent("test", "Haruspex")
      const hook = createHook()
      await hook["tool.execute.before"](
        { tool: "read", sessionID: "test", callID: "c1" },
        { args: { filePath: "src/plugin/index.ts" } },
      )
    })
  })

  describe("#given disabled hook", () => {
    test("#when Haruspex writing to denied path #then allows", async () => {
      updateSessionAgent("test", "Haruspex")
      const hook = createHook({ enabled: false })
      await hook["tool.execute.before"](
        { tool: "write", sessionID: "test", callID: "c1" },
        { args: { filePath: "src/plugin/index.ts", content: "new" } },
      )
    })
  })

  describe("#given no file path in args", () => {
    test("#when write without filePath #then allows", async () => {
      updateSessionAgent("test", "Haruspex")
      const hook = createHook()
      await hook["tool.execute.before"](
        { tool: "write", sessionID: "test", callID: "c1" },
        { args: {} },
      )
    })
  })
})
