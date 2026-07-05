import type { PermissionEntry, ProvenanceCheckResult } from "./types"

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return null

  const yaml = match[1]
  const result: Record<string, unknown> = {}
  let currentKey = ""

  for (const line of yaml.split("\n")) {
    const keyMatch = line.match(/^(\w[\w-]*):\s*(.*)/)
    if (keyMatch) {
      currentKey = keyMatch[1]
      const value = keyMatch[2].trim()
      if (value === "" || value === "[]") {
        result[currentKey] = []
      } else if (value.startsWith("[")) {
        result[currentKey] = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      } else {
        result[currentKey] = value.replace(/^["']|["']$/g, "")
      }
    } else if (line.startsWith("  - ") && currentKey) {
      const existing = result[currentKey]
      const item = line.slice(4).trim().replace(/^["']|["']$/g, "")
      if (Array.isArray(existing)) {
        existing.push(item)
      } else {
        result[currentKey] = [item]
      }
    }
  }

  return result
}

export function extractPermissions(frontmatter: Record<string, unknown>): PermissionEntry[] {
  const permissions: PermissionEntry[] = []

  const tools = frontmatter["allowed-tools"] ?? frontmatter["tools"]
  if (Array.isArray(tools)) {
    for (const tool of tools) {
      if (typeof tool === "string") {
        permissions.push({ type: "tool", name: tool })
      }
    }
  } else if (typeof tools === "string" && tools) {
    permissions.push({ type: "tool", name: tools })
  }

  const mcpServers = frontmatter["mcp"]
  if (Array.isArray(mcpServers)) {
    for (const server of mcpServers) {
      if (typeof server === "string") {
        permissions.push({ type: "mcp", name: server })
      }
    }
  } else if (typeof mcpServers === "string" && mcpServers) {
    permissions.push({ type: "mcp", name: mcpServers })
  }

  return permissions
}

export function reviewPermissions(
  content: string,
  requireReview: boolean,
): ProvenanceCheckResult {
  const frontmatter = parseFrontmatter(content)

  if (!frontmatter) {
    return {
      allowed: true,
      riskLevel: "low",
    }
  }

  const permissions = extractPermissions(frontmatter)

  if (permissions.length === 0) {
    return {
      allowed: true,
      riskLevel: "low",
    }
  }

  if (requireReview) {
    return {
      allowed: true,
      requiresApproval: true,
      permissions: permissions.map((p) => `${p.type}:${p.name}`),
      riskLevel: "medium",
    }
  }

  return {
    allowed: true,
    permissions: permissions.map((p) => `${p.type}:${p.name}`),
    riskLevel: "low",
  }
}
