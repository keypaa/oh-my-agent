/// <reference path="../../../../../bun-test.d.ts" />

import { afterAll, afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

async function importFreshMigrationModule(): Promise<typeof import("../migrate-legacy-plugin-entry")> {
  return import(`../migrate-legacy-plugin-entry?test=${Date.now()}-${Math.random()}`)
}

afterAll(() => {
  mock.restore()
})

describe("migrateLegacyPluginEntry", () => {
  let testDir = ""

  beforeEach(() => {
    testDir = join(tmpdir(), `omo-migrate-entry-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  describe("#given opencode.json contains oh-my-agent plugin entry", () => {
    describe("#when migrating the config", () => {
      it("#then replaces oh-my-agent with oh-my-agent", async () => {
        const configPath = join(testDir, "opencode.json")
        writeFileSync(configPath, JSON.stringify({ plugin: ["oh-my-agent@latest"] }, null, 2))
        const { migrateLegacyPluginEntry } = await importFreshMigrationModule()

        const result = migrateLegacyPluginEntry(configPath)

        expect(result).toBe(true)
        const content = readFileSync(configPath, "utf-8")
        expect(content).toContain("oh-my-agent@latest")
        expect(content).not.toContain("oh-my-agent")
      })
    })
  })

  describe("#given opencode.json contains bare oh-my-agent entry", () => {
    describe("#when migrating the config", () => {
      it("#then replaces with oh-my-agent", async () => {
        const configPath = join(testDir, "opencode.json")
        writeFileSync(configPath, JSON.stringify({ plugin: ["oh-my-agent"] }, null, 2))
        const { migrateLegacyPluginEntry } = await importFreshMigrationModule()

        const result = migrateLegacyPluginEntry(configPath)

        expect(result).toBe(true)
        const content = readFileSync(configPath, "utf-8")
        expect(content).toContain('"oh-my-agent"')
        expect(content).not.toContain("oh-my-agent")
      })
    })
  })

  describe("#given renaming the temp file fails after writing the migrated config", () => {
    describe("#when migrating the config", () => {
      it("#then keeps the original config untouched and writes the migrated content to a sibling temp file", async () => {
        const configPath = join(testDir, "opencode.json")
        const originalContent = JSON.stringify({ plugin: ["oh-my-agent@latest"] }, null, 2)
        const tempPath = `${configPath}.tmp`
        writeFileSync(configPath, originalContent)

        const fs = await import("node:fs")
        const renameSyncSpy = spyOn(fs, "renameSync").mockImplementation(() => {
          throw new Error("simulated rename failure")
        })

        try {
          const { migrateLegacyPluginEntry } = await importFreshMigrationModule()

          const result = migrateLegacyPluginEntry(configPath)

          expect(result).toBe(false)
          expect(readFileSync(configPath, "utf-8")).toBe(originalContent)
          expect(readFileSync(tempPath, "utf-8")).toContain("oh-my-agent@latest")
          expect(readFileSync(tempPath, "utf-8")).not.toContain("oh-my-agent")
        } finally {
          renameSyncSpy.mockRestore()
        }
      })
    })
  })

  describe("#given migration writes a temp file for fsync", () => {
    describe("#when opening the temp file descriptor", () => {
      it("#then uses r+ mode to satisfy FlushFileBuffers requirements on Windows", async () => {
        const configPath = join(testDir, "opencode.json")
        writeFileSync(configPath, JSON.stringify({ plugin: ["oh-my-agent@latest"] }, null, 2))

        const fs = await import("node:fs")
        const originalOpenSync = fs.openSync
        const openSyncCalls: string[] = []

        const openSyncSpy = spyOn(fs, "openSync").mockImplementation((
          path: Parameters<typeof fs.openSync>[0],
          flags: Parameters<typeof fs.openSync>[1],
        ) => {
            openSyncCalls.push(String(flags))
            return originalOpenSync(path, flags)
        })

        try {
          const { migrateLegacyPluginEntry } = await importFreshMigrationModule()

          const result = migrateLegacyPluginEntry(configPath)

          expect(result).toBe(true)
          expect(openSyncCalls).toContain("r+")
        } finally {
          openSyncSpy.mockRestore()
        }
      })
    })
  })

  describe("#given opencode.json contains pinned oh-my-agent version", () => {
    describe("#when migrating the config", () => {
      it("#then preserves the version pin", async () => {
        const configPath = join(testDir, "opencode.json")
        writeFileSync(configPath, JSON.stringify({ plugin: ["oh-my-agent@3.11.0"] }, null, 2))
        const { migrateLegacyPluginEntry } = await importFreshMigrationModule()

        const result = migrateLegacyPluginEntry(configPath)

        expect(result).toBe(true)
        const content = readFileSync(configPath, "utf-8")
        expect(content).toContain("oh-my-agent@3.11.0")
      })
    })
  })

  describe("#given opencode.json already uses oh-my-agent", () => {
    describe("#when checking for migration", () => {
      it("#then returns false and does not modify the file", async () => {
        const configPath = join(testDir, "opencode.json")
        const original = JSON.stringify({ plugin: ["oh-my-agent@latest"] }, null, 2)
        writeFileSync(configPath, original)
        const { migrateLegacyPluginEntry } = await importFreshMigrationModule()

        const result = migrateLegacyPluginEntry(configPath)

        expect(result).toBe(false)
        expect(readFileSync(configPath, "utf-8")).toBe(original)
      })
    })
  })

  describe("#given plugin entries contain both canonical and legacy values", () => {
    describe("#when migrating the config", () => {
      it("#then removes the legacy entry instead of duplicating the canonical one", async () => {
        const configPath = join(testDir, "opencode.json")
        writeFileSync(configPath, JSON.stringify({ plugin: ["oh-my-agent", "oh-my-agent"] }, null, 2))
        const { migrateLegacyPluginEntry } = await importFreshMigrationModule()

        const result = migrateLegacyPluginEntry(configPath)

        expect(result).toBe(true)
        const saved = JSON.parse(readFileSync(configPath, "utf-8")) as { plugin: string[] }
        expect(saved.plugin).toEqual(["oh-my-agent"])
      })
    })
  })

  describe("#given unrelated strings contain the legacy package name", () => {
    describe("#when migrating the config", () => {
      it("#then rewrites only plugin entries and preserves unrelated fields", async () => {
        const configPath = join(testDir, "opencode.json")
        writeFileSync(
          configPath,
          JSON.stringify(
            {
              plugin: ["oh-my-agent"],
              notes: "keep oh-my-agent in this text field",
              paths: ["/tmp/oh-my-agent/cache"],
            },
            null,
            2,
          ),
        )
        const { migrateLegacyPluginEntry } = await importFreshMigrationModule()

        const result = migrateLegacyPluginEntry(configPath)

        expect(result).toBe(true)
        const saved = JSON.parse(readFileSync(configPath, "utf-8")) as {
          plugin: string[]
          notes: string
          paths: string[]
        }
        expect(saved.plugin).toEqual(["oh-my-agent"])
        expect(saved.notes).toBe("keep oh-my-agent in this text field")
        expect(saved.paths).toEqual(["/tmp/oh-my-agent/cache"])
      })
    })
  })

  describe("#given opencode.jsonc contains a nested plugin key before the top-level plugin array", () => {
    describe("#when migrating the config", () => {
      it("#then rewrites only the top-level plugin array", async () => {
        const configPath = join(testDir, "opencode.jsonc")
        writeFileSync(
          configPath,
          `{
  "nested": {
    "plugin": ["oh-my-agent"]
  },
  "plugin": ["oh-my-agent@latest"]
}
`,
        )
        const { migrateLegacyPluginEntry } = await importFreshMigrationModule()

        const result = migrateLegacyPluginEntry(configPath)

        expect(result).toBe(true)
        const content = readFileSync(configPath, "utf-8")
        expect(content).toContain(`"nested": {
    "plugin": ["oh-my-agent"]
  }`)
        expect(content).toContain(`"plugin": [
    "oh-my-agent@latest"
  ]`)
      })
    })
  })

  describe("#given config file does not exist", () => {
    describe("#when attempting migration", () => {
      it("#then returns false", async () => {
        const { migrateLegacyPluginEntry } = await importFreshMigrationModule()
        const result = migrateLegacyPluginEntry(join(testDir, "nonexistent.json"))

        expect(result).toBe(false)
      })
    })
  })
})
