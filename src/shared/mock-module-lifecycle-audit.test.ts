/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

function __repoRootFrom(start: string): string {
  let dir = start
  for (;;) {
    if (existsSync(path.join(dir, "bun.lock")) || existsSync(path.join(dir, ".git"))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error("repo root sentinel not found")
    dir = parent
  }
}

const SOURCE_ROOT = path.resolve(import.meta.dir, "..")
const WORKSPACE_ROOT = __repoRootFrom(import.meta.dir)
const MOCK_MODULE_TOKEN = "mock.module"
const MOCK_MODULE_LIFECYCLE_ALLOWLIST = new Map<string, string>([
  // TODO(MOCK-MODULE-AUDIT): add cleanup for auto-update checker hook module mocks.
  [
    path.join(SOURCE_ROOT, "hooks", "auto-update-checker", "hook.test.ts"),
    "justification: legacy mock.module call predates audit; TODO(MOCK-MODULE-AUDIT): add cleanup",
  ],
  // TODO(MOCK-MODULE-AUDIT): add cleanup for tmux layout-runner module mocks.
  [
    path.join(SOURCE_ROOT, "shared", "tmux", "tmux-utils", "layout-runner.test.ts"),
    "justification: legacy mock.module call predates audit; TODO(MOCK-MODULE-AUDIT): add cleanup",
  ],
  // TODO(MOCK-MODULE-AUDIT): add cleanup for tmux pane-close-runner module mocks.
  [
    path.join(SOURCE_ROOT, "shared", "tmux", "tmux-utils", "pane-close-runner.test.ts"),
    "justification: legacy mock.module call predates audit; TODO(MOCK-MODULE-AUDIT): add cleanup",
  ],
  // TODO(MOCK-MODULE-AUDIT): add cleanup for tmux pane-close module mocks.
  [
    path.join(SOURCE_ROOT, "shared", "tmux", "tmux-utils", "pane-close.test.ts"),
    "justification: legacy mock.module call predates audit; TODO(MOCK-MODULE-AUDIT): add cleanup",
  ],
  // TODO(MOCK-MODULE-AUDIT): add cleanup for tmux pane-dimensions module mocks.
  [
    path.join(SOURCE_ROOT, "shared", "tmux", "tmux-utils", "pane-dimensions.test.ts"),
    "justification: legacy mock.module call predates audit; TODO(MOCK-MODULE-AUDIT): add cleanup",
  ],
  // TODO(MOCK-MODULE-AUDIT): add cleanup for tmux session-kill-runner module mocks.
  [
    path.join(SOURCE_ROOT, "shared", "tmux", "tmux-utils", "session-kill-runner.test.ts"),
    "justification: legacy mock.module call predates audit; TODO(MOCK-MODULE-AUDIT): add cleanup",
  ],
  // TODO(MOCK-MODULE-AUDIT): add cleanup for tmux session-kill module mocks.
  [
    path.join(SOURCE_ROOT, "shared", "tmux", "tmux-utils", "session-kill.test.ts"),
    "justification: legacy mock.module call predates audit; TODO(MOCK-MODULE-AUDIT): add cleanup",
  ],
  // TODO(MOCK-MODULE-AUDIT): add cleanup for tmux stale-session sweep module mocks.
  [
    path.join(SOURCE_ROOT, "shared", "tmux", "tmux-utils", "stale-session-sweep-runtime.test.ts"),
    "justification: legacy mock.module call predates audit; TODO(MOCK-MODULE-AUDIT): add cleanup",
  ],
  [
    