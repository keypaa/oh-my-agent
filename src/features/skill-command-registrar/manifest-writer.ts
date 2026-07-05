import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { SkillCommand, SkillManifest } from "./types"

export const MANIFEST_FILENAME = "skill-manifest.json"

export function getManifestPath(): string {
  return join(tmpdir(), MANIFEST_FILENAME)
}

export function writeSkillManifest(commands: SkillCommand[]): string {
  const manifest: SkillManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    commands,
  }

  const manifestPath = getManifestPath()
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8")
  return manifestPath
}
