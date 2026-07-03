import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { migrateLegacyConfigFile } from "./migrate-legacy-config-file"

describe("migrateLegacyConfigFile", () => {
  let testDir = ""

  beforeEach(() => {
    testDir = join(tmpdir(), `omo-migrate-config-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  // #note: In this fork LEGACY_CONFIG_BASENAME === CONFIG_BASENAME ("oh-my-agent"),
  // so migration is always a no-op — the names are already identical.

  describe("#given config file exists with the same legacy and canonical basename", () => {
    describe("#when migrateLegacyConfigFile is called", () => {
      it("#then returns false (no migration needed when old==new)", () => {
        const legacyPath = join(testDir, "oh-my-agent.jsonc")
        writeFileSync(legacyPath, '{ "agents": {} }')

        const result = migrateLegacyConfigFile(legacyPath)

        expect(result).toBe(false)
        expect(existsSync(legacyPath)).toBe(true)
        expect(existsSync(`${legacyPath}.bak`)).toBe(false)
      })
    })
  })

  describe("#given a sidecar file exists with the same legacy and canonical basename", () => {
    describe("#when migrateLegacyConfigFile is called", () => {
      it("#then returns false (no migration needed when old==new)", () => {
        const legacyPath = join(testDir, "oh-my-agent.json")
        const sidecarPath = `${legacyPath}.migrations.json`
        writeFileSync(legacyPath, '{ "agents": { "oracle": { "model": "anthropic/claude-opus-4-6" } } }')
        writeFileSync(
          sidecarPath,
          JSON.stringify({
            appliedMigrations: [
              "model-version:anthropic/claude-opus-4-6->anthropic/claude-opus-4-7",
            ],
          }),
        )

        const result = migrateLegacyConfigFile(legacyPath)

        expect(result).toBe(false)
        expect(existsSync(legacyPath)).toBe(true)
      })
    })
  })

  describe("#given oh-my-agent.json exists with the same legacy and canonical basename", () => {
    describe("#when migrateLegacyConfigFile is called", () => {
      it("#then returns false (no migration needed when old==new)", () => {
        const legacyPath = join(testDir, "oh-my-agent.json")
        writeFileSync(legacyPath, '{ "agents": {} }')

        const result = migrateLegacyConfigFile(legacyPath)

        expect(result).toBe(false)
        expect(existsSync(legacyPath)).toBe(true)
      })
    })
  })

  describe("#given oh-my-agent.jsonc already exists (canonical has content too)", () => {
    describe("#when migrateLegacyConfigFile is called", () => {
      it("#then returns false (already canonical, no migration needed)", () => {
        const legacyPath = join(testDir, "oh-my-agent.jsonc")
        writeFileSync(legacyPath, '{ "old": true }')

        const result = migrateLegacyConfigFile(legacyPath)

        expect(result).toBe(false)
      })
    })
  })

  describe("#given the file does not exist", () => {
    describe("#when attempting migration", () => {
      it("#then returns false", () => {
        const result = migrateLegacyConfigFile(join(testDir, "oh-my-agent.jsonc"))

        expect(result).toBe(false)
      })
    })
  })

  describe("#given the file is not a legacy config file", () => {
    describe("#when attempting migration", () => {
      it("#then returns false", () => {
        const nonLegacyPath = join(testDir, "something-else.jsonc")
        writeFileSync(nonLegacyPath, "{}")

        const result = migrateLegacyConfigFile(nonLegacyPath)

        expect(result).toBe(false)
      })
    })
  })

  describe("#given canonical write succeeds but archive fails", () => {
    describe("#when migrateLegacyConfigFile is called", () => {
      it("#then returns false (no migration needed when old==new)", () => {
        const legacyPath = join(testDir, "oh-my-agent.jsonc")
        const backupPath = `${legacyPath}.bak`
        writeFileSync(legacyPath, '{ "agents": {} }')

        // given: create backup path as directory (blocks rename, causing archive to return false)
        mkdirSync(backupPath)

        // when: migrate the config file
        const result = migrateLegacyConfigFile(legacyPath)

        // then: no migration happens when old==new
        expect(result).toBe(false)
        expect(existsSync(legacyPath)).toBe(true)
      })
    })
  })
})
