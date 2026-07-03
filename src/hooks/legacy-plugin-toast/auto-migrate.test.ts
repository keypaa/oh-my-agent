import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const mockMigrateLegacyPluginEntry = mock(() => true)

mock.module("./plugin-entry-migrator", () => ({
  migrateLegacyPluginEntry: mockMigrateLegacyPluginEntry,
}))
mock.module("./plugin-entry-migrator.ts", () => ({
  migrateLegacyPluginEntry: mockMigrateLegacyPluginEntry,
}))

const autoMigrateModulePromise = import("./auto-migrate")

describe("autoMigrateLegacyPluginEntry", () => {
  let testConfigDir = ""

  beforeEach(() => {
    testConfigDir = join(tmpdir(), `omo-legacy-migrate-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testConfigDir, { recursive: true })
    mockMigrateLegacyPluginEntry.mockReset()
    mockMigrateLegacyPluginEntry.mockReturnValue(true)
  })

  afterEach(() => {
    rmSync(testConfigDir, { recursive: true, force: true })
  })

  // #note: In this fork LEGACY_PLUGIN_NAME === PLUGIN_NAME ("oh-my-agent"),
  // so isLegacyEntry (from shared plugin-entry-migrator) returns false for everything,
  // making auto-migration a no-op.

  describe("#given opencode.json has a plugin entry with oh-my-agent", () => {
    it("#then returns not migrated (already canonical when old==new)", async () => {
      // given
      writeFileSync(
        join(testConfigDir, "opencode.json"),
        JSON.stringify({ plugin: ["oh-my-agent"] }, null, 2) + "\n",
      )

      const { autoMigrateLegacyPluginEntry } = await autoMigrateModulePromise

      // when
      const result = autoMigrateLegacyPluginEntry(testConfigDir)

      // then
      expect(result.migrated).toBe(false)
      expect(result.from).toBeNull()
      expect(mockMigrateLegacyPluginEntry).not.toHaveBeenCalled()
    })
  })

  describe("#given opencode.json has a version-pinned oh-my-agent entry", () => {
    it("#then returns not migrated (already canonical when old==new)", async () => {
      // given
      writeFileSync(
        join(testConfigDir, "opencode.json"),
        JSON.stringify({ plugin: ["oh-my-agent@3.10.0"] }, null, 2) + "\n",
      )

      const { autoMigrateLegacyPluginEntry } = await autoMigrateModulePromise

      // when
      const result = autoMigrateLegacyPluginEntry(testConfigDir)

      // then
      expect(result.migrated).toBe(false)
      expect(mockMigrateLegacyPluginEntry).not.toHaveBeenCalled()
    })
  })

  describe("#given both entries exist with the same name", () => {
    it("#then returns not migrated (all entries are already canonical)", async () => {
      // given
      writeFileSync(
        join(testConfigDir, "opencode.json"),
        JSON.stringify({ plugin: ["oh-my-agent", "oh-my-agent"] }, null, 2) + "\n",
      )

      const { autoMigrateLegacyPluginEntry } = await autoMigrateModulePromise

      // when
      const result = autoMigrateLegacyPluginEntry(testConfigDir)

      // then
      expect(result.migrated).toBe(false)
      expect(mockMigrateLegacyPluginEntry).not.toHaveBeenCalled()
    })
  })

  describe("#given no config file exists", () => {
    it("#then returns migrated false", async () => {
      // given - empty dir
      const { autoMigrateLegacyPluginEntry } = await autoMigrateModulePromise

      // when
      const result = autoMigrateLegacyPluginEntry(testConfigDir)

      // then
      expect(result.migrated).toBe(false)
      expect(result.from).toBeNull()
      expect(mockMigrateLegacyPluginEntry).not.toHaveBeenCalled()
    })
  })

  describe("#given opencode.jsonc has comments with oh-my-agent entry", () => {
    it("#then returns not migrated (already canonical when old==new)", async () => {
      // given
      writeFileSync(
        join(testConfigDir, "opencode.jsonc"),
        '{\n  // my config\n  "plugin": ["oh-my-agent"]\n}\n',
      )

      const { autoMigrateLegacyPluginEntry } = await autoMigrateModulePromise

      // when
      const result = autoMigrateLegacyPluginEntry(testConfigDir)

      // then
      expect(result.migrated).toBe(false)
      expect(mockMigrateLegacyPluginEntry).not.toHaveBeenCalled()
    })
  })

  describe("#given opencode.jsonc has a nested plugin key before the root plugin array", () => {
    it("#then returns not migrated (all entries already canonical)", async () => {
      // given
      writeFileSync(
        join(testConfigDir, "opencode.jsonc"),
        `{
  "nested": {
    "plugin": ["oh-my-agent"]
  },
  "plugin": ["oh-my-agent@latest"]
}
`,
      )

      const { autoMigrateLegacyPluginEntry } = await autoMigrateModulePromise

      // when
      const result = autoMigrateLegacyPluginEntry(testConfigDir)

      // then
      expect(result.migrated).toBe(false)
      expect(mockMigrateLegacyPluginEntry).not.toHaveBeenCalled()
    })
  })

  describe("#given the migrator throws while rewriting a legacy entry", () => {
    it("#then returns migrated false", async () => {
      // given
      writeFileSync(
        join(testConfigDir, "opencode.json"),
        JSON.stringify({ plugin: ["oh-my-agent"] }, null, 2) + "\n",
      )
      mockMigrateLegacyPluginEntry.mockImplementation(() => {
        throw new Error("rewrite failed")
      })

      const { autoMigrateLegacyPluginEntry } = await autoMigrateModulePromise

      // when
      const result = autoMigrateLegacyPluginEntry(testConfigDir)

      // then
      expect(result.migrated).toBe(false)
      expect(result.from).toBeNull()
      expect(result.to).toBeNull()
      expect(result.configPath).toBe(join(testConfigDir, "opencode.json"))
    })
  })

  describe("#given only canonical entry exists", () => {
    it("#then returns migrated false and leaves file untouched", async () => {
      // given
      const original = JSON.stringify({ plugin: ["oh-my-agent"] }, null, 2) + "\n"
      writeFileSync(join(testConfigDir, "opencode.json"), original)

      const { autoMigrateLegacyPluginEntry } = await autoMigrateModulePromise

      // when
      const result = autoMigrateLegacyPluginEntry(testConfigDir)

      // then
      expect(result.migrated).toBe(false)
      expect(mockMigrateLegacyPluginEntry).not.toHaveBeenCalled()
    })
  })
})
