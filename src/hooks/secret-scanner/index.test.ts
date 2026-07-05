import { describe, expect, test } from "bun:test"
import { createSecretScannerHook } from "./index"
import type { SecretScannerConfig } from "../../features/security-guards/config-schema"

const DEFAULT_CONFIG: SecretScannerConfig = {
  enabled: true,
  severity: { known_patterns: "block", entropy: "warn" },
  allowlist_patterns: ["test-*", "**/fixtures/**"],
  allowlist_paths: ["**/*.test.ts", "**/*.md"],
}

type Hook = ReturnType<typeof createSecretScannerHook>

function createHook(overrides?: Partial<SecretScannerConfig>): Hook {
  return createSecretScannerHook({ config: { ...DEFAULT_CONFIG, ...overrides } })
}

async function expectBlocked(
  hook: Hook,
  args: Record<string, unknown>,
): Promise<string> {
  let caughtMessage = ""
  try {
    await hook["tool.execute.before"]?.(
      { tool: "write", sessionID: "test", callID: "c1" } as never,
      { args } as never,
    )
  } catch (err) {
    if (err instanceof Error) caughtMessage = err.message
    else throw err
  }
  expect(caughtMessage).not.toBe("")
  return caughtMessage
}

describe("createSecretScannerHook", () => {
  describe("#given known secret patterns", () => {
    test("#when AWS key in content #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: 'const AWS_KEY = "AKIAIOSFODNN7EXAMPLE"',
      })
      expect(msg).toContain("AWS Access Key")
    })

    test("#when OpenAI key in content #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: "api_key: sk-projFAKEKEY1234567890abcdefghij",
      })
      expect(msg).toContain("OpenAI API Key")
    })

    test("#when Anthropic key in content #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: "key=sk-ant-api03-FAKEKEY123456789012345678",
      })
      expect(msg).toContain("Anthropic API Key")
    })

    test("#when GitHub token in content #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: "token: ghp_FAKEKEY123456789012345678901234567890",
      })
      expect(msg).toContain("GitHub Token")
    })

    test("#when private key in content #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: "-----BEGIN RSA PRIVATE KEY-----\nMIIE...",
      })
      expect(msg).toContain("Private Key")
    })

    test("#when env secret assignment #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: 'DATABASE_PASSWORD="supersecret12345"',
      })
      expect(msg).toContain("Env Secret Assignment")
    })

    test("#when Slack bot token #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: 'SLACK_TOKEN="xoxb-0000000000-0000000000000-TESTFAKE"',
      })
      expect(msg).toContain("Slack Token")
    })

    test("#when Slack user token #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: 'SLACK_TOKEN="xoxp-0000000000-0000000000000-TESTFAKE"',
      })
      expect(msg).toContain("Slack Token")
    })

    test("#when npm token #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: 'NPM_TOKEN="npm_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901"',
      })
      expect(msg).toContain("npm Token")
    })

    test("#when GCP service account key #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: '{"type": "service_account", "project_id": "my-project"}',
      })
      expect(msg).toContain("GCP Service Account Key")
    })

    test("#when database connection string with password #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: 'DATABASE_URL="postgres://admin:secretpass@localhost:5432/mydb"',
      })
      expect(msg).toContain("Database Connection String")
    })

    test("#when multiple secrets #then blocks with all", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: 'AWS_KEY="AKIAIOSFODNN7EXAMPLE"\nOPENAI="sk-projFAKEKEY1234567890abcdefgh"',
      })
      expect(msg).toContain("AWS Access Key")
      expect(msg).toContain("OpenAI API Key")
    })
  })

  describe("#given clean content", () => {
    test("#when no secrets #then allows", async () => {
      const hook = createHook()
      await hook["tool.execute.before"]?.(
        { tool: "write", sessionID: "test", callID: "c1" } as never,
        { args: { filePath: "src/config.ts", content: 'export const name = "hello"' } } as never,
      )
    })
  })

  describe("#given allowlisted paths", () => {
    test("#when test file #then skips scan", async () => {
      const hook = createHook()
      await hook["tool.execute.before"]?.(
        { tool: "write", sessionID: "test", callID: "c1" } as never,
        {
          args: {
            filePath: "src/config.test.ts",
            content: 'const AKIAIOSFODNN7EXAMPLE = "test"',
          },
        } as never,
      )
    })

    test("#when fixtures path #then skips scan", async () => {
      const hook = createHook()
      await hook["tool.execute.before"]?.(
        { tool: "write", sessionID: "test", callID: "c1" } as never,
        {
          args: {
            filePath: "test/fixtures/mock-key.ts",
            content: 'AKIAIOSFODNN7EXAMPLE',
          },
        } as never,
      )
    })
  })

  describe("#given warn-only severity", () => {
    test("#when known_patterns is warn #then does not block", async () => {
      const hook = createHook({
        severity: { known_patterns: "warn", entropy: "warn" },
      })
      await hook["tool.execute.before"]?.(
        { tool: "write", sessionID: "test", callID: "c1" } as never,
        {
          args: {
            filePath: "src/config.ts",
            content: 'const AWS_KEY = "AKIAIOSFODNN7EXAMPLE"',
          },
        } as never,
      )
    })
  })

  describe("#given non-write tools", () => {
    test("#when read tool #then no scan", async () => {
      const hook = createHook()
      await hook["tool.execute.before"]?.(
        { tool: "read", sessionID: "test", callID: "c1" } as never,
        {
          args: {
            filePath: "src/config.ts",
            content: 'const AKIAIOSFODNN7EXAMPLE = "test"',
          },
        } as never,
      )
    })
  })

  describe("#given entropy block severity", () => {
    test("#when entropy is block and high-entropy string present #then blocks", async () => {
      const hook = createHook({
        severity: { known_patterns: "warn", entropy: "block" },
      })
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        content: 'const TOKEN = "aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG"',
      })
      expect(msg).toContain("High-entropy string detected")
    })

    test("#when entropy is warn and high-entropy string present #then does not block", async () => {
      const hook = createHook({
        severity: { known_patterns: "warn", entropy: "warn" },
      })
      await hook["tool.execute.before"]?.(
        { tool: "write", sessionID: "test", callID: "c1" } as never,
        {
          args: {
            filePath: "src/config.ts",
            content: 'const TOKEN = "aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG"',
          },
        } as never,
      )
    })
  })

  describe("#given disabled config", () => {
    test("#when hook disabled #then no scan", async () => {
      const hook = createHook({ enabled: false })
      await hook["tool.execute.before"]?.(
        { tool: "write", sessionID: "test", callID: "c1" } as never,
        {
          args: {
            filePath: "src/config.ts",
            content: 'const AKIAIOSFODNN7EXAMPLE = "test"',
          },
        } as never,
      )
    })
  })

  describe("#given edit tool", () => {
    test("#when edit contains secret #then blocks", async () => {
      const hook = createHook()
      const msg = await expectBlocked(hook, {
        filePath: "src/config.ts",
        newString: 'const key = "sk-ant-api03-FAKEKEY123456789012345678"',
      })
      expect(msg).toContain("Anthropic API Key")
    })
  })
})
