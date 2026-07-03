import { describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const { checkForLegacyPluginEntry } = await import(
  new URL("./legacy-plugin-warning.ts?real-legacy-plugin-warning-test", import.meta.url).href
)

function createTestConfigDir(): string {
  return mkdtempSync(join(tmpdir(), "omo-legacy-check-"))
}

function cleanupTestConfigDir(testConfigDir: string): void {
  rmSync(testConfigDir, { recursive: true, force: true })
}

describe("checkForLegacyPluginEntry", () => {
  // #note: In this fork LEGACY_PLUGIN_NAME === PLUGIN_NAME ("oh-my-agent"),
  // so no entry is ever treated as a "legacy" entry — everything is canonical.

  it("does not flag oh-my-agent as legacy when old==new", () => {
    const testConfigDir = createTestConfigDir()

    try {
      // given
      writeFileSync(join(testConfigDir, "opencode.json"), JSON.stringify({ plugin: ["oh-my-agent"] }, null, 2))

      // when
      const result = checkForLegacyPluginEntry(testConfigDir)

      // then
      expect(result.hasLegacyEntry).toBe(false)
      expect(result.hasCanonicalEntry).toBe(true)
      expect(result.legacyEntries).toEqual([])
      expect(result.configPath).toBe(join(testConfigDir, "opencode.json"))
    } finally {
      cleanupTestConfigDir(testConfigDir)
    }
  })

  it("does not flag a version-pinned oh-my-agent entry as legacy when old==new", () => {
    const testConfigDir = createTestConfigDir()

    try {
      // given
      writeFileSync(join(testConfigDir, "opencode.json"), JSON.stringify({ plugin: ["oh-my-agent@3.10.0"] }, null, 2))

      // when
      const result = checkForLegacyPluginEntry(testConfigDir)

      // then
      expect(result.hasLegacyEntry).toBe(false)
      expect(result.hasCanonicalEntry).toBe(true)
      expect(result.legacyEntries).toEqual([])
    } finally {
      cleanupTestConfigDir(testConfigDir)
    }
  })

  it("does not flag a canonical plugin entry", () => {
    const testConfigDir = createTestConfigDir()

    try {
      // given
      writeFileSync(join(testConfigDir, "opencode.json"), JSON.stringify({ plugin: ["oh-my-agent"] }, null, 2))

      // when
      const result = checkForLegacyPluginEntry(testConfigDir)

      // then
      expect(result.hasLegacyEntry).toBe(false)
      expect(result.hasCanonicalEntry).toBe(true)
      expect(result.legacyEntries).toEqual([])
    } finally {
      cleanupTestConfigDir(testConfigDir)
    }
  })

  it("does not flag legacy entries in jsonc config when old==new", () => {
    const testConfigDir = createTestConfigDir()

    try {
      // given
      writeFileSync(join(testConfigDir, "opencode.jsonc"), '{\n  "plugin": ["oh-my-agent"]\n}\n')

      // when
      const result = checkForLegacyPluginEntry(testConfigDir)

      // then
      expect(result.hasLegacyEntry).toBe(false)
      expect(result.legacyEntries).toEqual([])
    } finally {
      cleanupTestConfigDir(testConfigDir)
    }
  })

  it("returns no warning data when config is missing", () => {
    const testConfigDir = createTestConfigDir()

    try {
      // when
      const result = checkForLegacyPluginEntry(testConfigDir)

      // then
      expect(result.hasLegacyEntry).toBe(false)
      expect(result.hasCanonicalEntry).toBe(false)
      expect(result.legacyEntries).toEqual([])
      expect(result.configPath).toBeNull()
    } finally {
      cleanupTestConfigDir(testConfigDir)
    }
  })
})
