import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { getBundledVersion } from "./bundled-version"

describe("getBundledVersion (GH-4211)", () => {
  it("returns the published root package version, not the workspace-internal one", () => {
    // given the root package.json that the published dist ships under
    const repoRoot = join(import.meta.dir, "..", "..", "..", "..")
    const rootPackageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8")) as { name: string; version: string }

    // when
    const bundledVersion = getBundledVersion()
  })
})
