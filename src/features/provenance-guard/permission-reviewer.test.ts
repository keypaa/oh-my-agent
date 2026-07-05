import { describe, expect, test } from "bun:test"
import { reviewPermissions, extractPermissions } from "./permission-reviewer"

describe("reviewPermissions", () => {
  describe("#given content without frontmatter", () => {
    test("#when no YAML frontmatter #then allows", () => {
      const result = reviewPermissions("# Skill\n\nNo frontmatter here.", true)
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe("low")
    })
  })

  describe("#given content with frontmatter", () => {
    test("#when no permissions declared #then allows", () => {
      const content = "---\nname: my-skill\ndescription: A skill\n---\n\n# Skill"
      const result = reviewPermissions(content, true)
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe("low")
    })

    test("#when tool permissions and review required #then requires approval", () => {
      const content =
        "---\nname: my-skill\nallowed-tools:\n  - read\n  - write\n---\n\n# Skill"
      const result = reviewPermissions(content, true)
      expect(result.allowed).toBe(true)
      expect(result.requiresApproval).toBe(true)
      expect(result.riskLevel).toBe("medium")
      expect(result.permissions).toContain("tool:read")
      expect(result.permissions).toContain("tool:write")
    })

    test("#when tool permissions and review not required #then allows without approval", () => {
      const content =
        "---\nname: my-skill\nallowed-tools:\n  - read\n---\n\n# Skill"
      const result = reviewPermissions(content, false)
      expect(result.allowed).toBe(true)
      expect(result.requiresApproval).toBeUndefined()
      expect(result.riskLevel).toBe("low")
    })

    test("#when MCP permissions declared #then includes MCP in permissions", () => {
      const content =
        "---\nname: my-skill\nmcp:\n  - filesystem\n---\n\n# Skill"
      const result = reviewPermissions(content, true)
      expect(result.allowed).toBe(true)
      expect(result.permissions).toContain("mcp:filesystem")
    })

    test("#when inline tools string #then parses single tool", () => {
      const content =
        '---\nname: my-skill\nallowed-tools: read\n---\n\n# Skill'
      const result = reviewPermissions(content, true)
      expect(result.allowed).toBe(true)
      expect(result.permissions).toContain("tool:read")
    })
  })
})

describe("extractPermissions", () => {
  test("#when allowed-tools array #then extracts tools", () => {
    const permissions = extractPermissions({
      "allowed-tools": ["read", "write", "grep"],
    })
    expect(permissions).toEqual([
      { type: "tool", name: "read" },
      { type: "tool", name: "write" },
      { type: "tool", name: "grep" },
    ])
  })

  test("#when mcp array #then extracts MCP servers", () => {
    const permissions = extractPermissions({
      mcp: ["filesystem", "github"],
    })
    expect(permissions).toEqual([
      { type: "mcp", name: "filesystem" },
      { type: "mcp", name: "github" },
    ])
  })

  test("#when no permissions #then returns empty", () => {
    const permissions = extractPermissions({})
    expect(permissions).toEqual([])
  })
})
