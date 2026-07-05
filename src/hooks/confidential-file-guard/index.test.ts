import { describe, expect, test } from "bun:test"
import { createConfidentialFileGuardHook } from "./index"
import type { ConfidentialFilesConfig } from "../../features/security-guards/config-schema"

const DEFAULT_CONFIG: ConfidentialFilesConfig = {
  enabled: true,
  paths: [".env", ".env.*", "**/secrets/**", "**/*.pem", "**/credentials.json", "**/service-account.json"],
  block_message: "Access to '{path}' is blocked by security policy.",
}

type Hook = ReturnType<typeof createConfidentialFileGuardHook>

function createHook(overrides?: Partial<ConfidentialFilesConfig>): Hook {
  return createConfidentialFileGuardHook({ config: { ...DEFAULT_CONFIG, ...overrides } })
}

async function expectBlocked(
  hook: Hook,
  tool: string,
  args: Record<string, unknown>,
): Promise<string> {
  let caughtMessage = ""
  try {
    await hook["tool.execute.before"]?.(
      { tool, sessionID: "test", callID: "c1" } as never,
      { args } as never,
    )
  } catch (err) {
    if (err instanceof Error) caughtMessage = err.message
    else throw err
  }
  expect(caughtMessage).not.toBe("")
  return caughtMessage
}

describe("createConfidentialFileGuardHook", () => {
  describe("#given Read tool", () => {
    test("#when filePath matches .env #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, "read", { filePath: ".env" })
      expect(msg).toContain(".env")
      expect(msg).toContain("blocked by security policy")
    })

    test("#when filePath matches .env.production #then blocks", async () => {
      const hook = createHook()
      await expectBlocked(hook, "read", { filePath: ".env.production" })
    })

    test("#when filePath matches secrets path #then blocks", async () => {
      const hook = createHook()
      await expectBlocked(hook, "read", { filePath: "config/secrets/api-key.json" })
    })

    test("#when filePath matches *.pem #then blocks", async () => {
      const hook = createHook()
      await expectBlocked(hook, "read", { filePath: "certs/server.pem" })
    })

    test("#when filePath matches credentials.json #then blocks", async () => {
      const hook = createHook()
      await expectBlocked(hook, "read", { filePath: "gcloud/credentials.json" })
    })

    test("#when filePath is regular src file #then allows", async () => {
      const hook = createHook()
      await hook["tool.execute.before"]?.(
        { tool: "read", sessionID: "test", callID: "c1" } as never,
        { args: { filePath: "src/index.ts" } } as never,
      )
    })
  })

  describe("#given Bash tool", () => {
    test("#when cat .env #then blocks", async () => {
      const hook = createHook()
      await expectBlocked(hook, "bash", { command: "cat .env" })
    })

    test("#when type .env #then blocks (Windows)", async () => {
      const hook = createHook()
      await expectBlocked(hook, "bash", { command: "type .env" })
    })

    test("#when printenv #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, "bash", { command: "printenv" })
      expect(msg).toContain("Environment variable dumps")
    })

    test("#when source .env #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, "bash", { command: "source .env" })
      expect(msg).toContain("Sourcing .env files")
    })

    test("#when . .env #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, "bash", { command: ". .env" })
      expect(msg).toContain("Sourcing .env files")
    })

    test("#when regular command #then allows", async () => {
      const hook = createHook()
      await hook["tool.execute.before"]?.(
        { tool: "bash", sessionID: "test", callID: "c1" } as never,
        { args: { command: "ls -la" } } as never,
      )
    })

    test("#when cat regular file #then allows", async () => {
      const hook = createHook()
      await hook["tool.execute.before"]?.(
        { tool: "bash", sessionID: "test", callID: "c1" } as never,
        { args: { command: "cat src/index.ts" } } as never,
      )
    })
  })

  describe("#given Grep tool", () => {
    test("#when path is confidential #then blocks", async () => {
      const hook = createHook()
      await expectBlocked(hook, "grep", { path: ".env", target: "KEY" })
    })
  })

  describe("#given Glob tool (after hook)", () => {
    test("#when results contain .env files #then filters them out", async () => {
      const hook = createHook()
      const output = {
        title: "glob",
        output: JSON.stringify(["src/index.ts", ".env", ".env.local", "README.md"]),
        metadata: {},
      }
      await hook["tool.execute.after"]?.(
        { tool: "glob", sessionID: "test", callID: "c1", args: {} } as never,
        output as never,
      )
      const filtered = JSON.parse(output.output) as string[]
      expect(filtered).toEqual(["src/index.ts", "README.md"])
    })

    test("#when no blocked files #then output unchanged", async () => {
      const hook = createHook()
      const output = {
        title: "glob",
        output: JSON.stringify(["src/index.ts", "README.md"]),
        metadata: {},
      }
      await hook["tool.execute.after"]?.(
        { tool: "glob", sessionID: "test", callID: "c1", args: {} } as never,
        output as never,
      )
      const filtered = JSON.parse(output.output) as string[]
      expect(filtered).toEqual(["src/index.ts", "README.md"])
    })
  })

  describe("#given disabled config", () => {
    test("#when hook disabled #then no blocking", async () => {
      const hook = createHook({ enabled: false })
      await hook["tool.execute.before"]?.(
        { tool: "read", sessionID: "test", callID: "c1" } as never,
        { args: { filePath: ".env" } } as never,
      )
    })
  })

  describe("#given non-blocked tools", () => {
    test("#when write tool #then no interception", async () => {
      const hook = createHook()
      await hook["tool.execute.before"]?.(
        { tool: "write", sessionID: "test", callID: "c1" } as never,
        { args: { filePath: ".env" } } as never,
      )
    })
  })
})
