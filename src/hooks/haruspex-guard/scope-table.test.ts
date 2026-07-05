import { describe, expect, test } from "bun:test"
import { resolvePathVerdict, matchesAny } from "./scope-table"
import type { HaruspexGuardConfig } from "../../config/schema/haruspex-guard"

const DEFAULT_CONFIG: HaruspexGuardConfig = {
  enabled: true,
  allowed_paths: [
    "src/agents/**",
    "src/hooks/**",
    "src/features/builtin-skills/**",
    "src/config/schema/**",
    "src/cli/**",
    "packages/shared-skills/**",
    "docs/**",
    "*.md",
  ],
  denied_paths: [
    "src/plugin/**",
    "src/shared/**",
    "src/mcp/**",
    "package.json",
    "bun.lock",
    ".git/**",
  ],
  require_confirmation: [
    "src/agents/builtin-agents.ts",
    "src/config/schema/oh-my-opencode-config.ts",
    "src/plugin-handlers/**",
  ],
  show_diff: true,
}

describe("matchesAny", () => {
  test("#when file matches glob pattern #then returns true", () => {
    expect(matchesAny("src/agents/sisyphus.ts", ["src/agents/**"])).toBe(true)
  })

  test("#when file does not match #then returns false", () => {
    expect(matchesAny("src/plugin/index.ts", ["src/agents/**"])).toBe(false)
  })

  test("#when patterns empty #then returns false", () => {
    expect(matchesAny("anything.ts", [])).toBe(false)
  })

  test("#when file matches one of many patterns #then returns true", () => {
    expect(matchesAny("package.json", ["package.json", "bun.lock"])).toBe(true)
  })
})

describe("resolvePathVerdict", () => {
  describe("#given allowed paths", () => {
    test("#when src/agents/sisyphus.ts #then allowed", () => {
      expect(resolvePathVerdict("src/agents/sisyphus.ts", DEFAULT_CONFIG)).toBe("allowed")
    })

    test("#when src/hooks/comment-checker/index.ts #then allowed", () => {
      expect(resolvePathVerdict("src/hooks/comment-checker/index.ts", DEFAULT_CONFIG)).toBe("allowed")
    })

    test("#when src/features/builtin-skills/git-master.ts #then allowed", () => {
      expect(resolvePathVerdict("src/features/builtin-skills/git-master.ts", DEFAULT_CONFIG)).toBe("allowed")
    })

    test("#when src/config/schema/hooks.ts #then allowed", () => {
      expect(resolvePathVerdict("src/config/schema/hooks.ts", DEFAULT_CONFIG)).toBe("allowed")
    })

    test("#when src/cli/cli-program.ts #then allowed", () => {
      expect(resolvePathVerdict("src/cli/cli-program.ts", DEFAULT_CONFIG)).toBe("allowed")
    })

    test("#when docs/guide/installation.md #then allowed", () => {
      expect(resolvePathVerdict("docs/guide/installation.md", DEFAULT_CONFIG)).toBe("allowed")
    })

    test("#when README.md #then allowed", () => {
      expect(resolvePathVerdict("README.md", DEFAULT_CONFIG)).toBe("allowed")
    })
  })

  describe("#given denied paths", () => {
    test("#when src/plugin/index.ts #then denied", () => {
      expect(resolvePathVerdict("src/plugin/index.ts", DEFAULT_CONFIG)).toBe("denied")
    })

    test("#when src/shared/logger.ts #then denied", () => {
      expect(resolvePathVerdict("src/shared/logger.ts", DEFAULT_CONFIG)).toBe("denied")
    })

    test("#when src/mcp/lsp/index.ts #then denied", () => {
      expect(resolvePathVerdict("src/mcp/lsp/index.ts", DEFAULT_CONFIG)).toBe("denied")
    })

    test("#when package.json #then denied", () => {
      expect(resolvePathVerdict("package.json", DEFAULT_CONFIG)).toBe("denied")
    })

    test("#when bun.lock #then denied", () => {
      expect(resolvePathVerdict("bun.lock", DEFAULT_CONFIG)).toBe("denied")
    })

    test("#when .git/config #then denied", () => {
      expect(resolvePathVerdict(".git/config", DEFAULT_CONFIG)).toBe("denied")
    })
  })

  describe("#given require_confirmation paths", () => {
    test("#when src/agents/builtin-agents.ts #then confirm", () => {
      expect(resolvePathVerdict("src/agents/builtin-agents.ts", DEFAULT_CONFIG)).toBe("confirm")
    })

    test("#when src/config/schema/oh-my-opencode-config.ts #then confirm", () => {
      expect(resolvePathVerdict("src/config/schema/oh-my-opencode-config.ts", DEFAULT_CONFIG)).toBe("confirm")
    })

    test("#when src/plugin-handlers/agent-config-handler.ts #then confirm", () => {
      expect(resolvePathVerdict("src/plugin-handlers/agent-config-handler.ts", DEFAULT_CONFIG)).toBe("confirm")
    })
  })

  describe("#given denied takes precedence over allowed", () => {
    test("#when path matches both allowed and denied #then denied", () => {
      const config: HaruspexGuardConfig = {
        ...DEFAULT_CONFIG,
        allowed_paths: ["src/plugin/**"],
        denied_paths: ["src/plugin/**"],
      }
      expect(resolvePathVerdict("src/plugin/index.ts", config)).toBe("denied")
    })
  })

  describe("#given path outside all scopes", () => {
    test("#when unknown path #then denied", () => {
      expect(resolvePathVerdict("random-file.txt", DEFAULT_CONFIG)).toBe("denied")
    })
  })

  describe("#given Windows-style paths", () => {
    test("#when backslash path #then normalized and matched", () => {
      expect(resolvePathVerdict("src\\agents\\sisyphus.ts", DEFAULT_CONFIG)).toBe("allowed")
    })
  })
})
