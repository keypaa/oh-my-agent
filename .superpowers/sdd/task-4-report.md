# Task 4 Report: Inline Tier-3 Packages + Vendored MCP Updates

**Status:** DONE_WITH_CONCERNS

## Summary
Inlined 4 tier-3 core packages into `src/shared/`, updated vendored MCP deps, added path aliases, removed boulder-state duplicate.

## Packages Inlined
- `mcp-client-core` (30 files, ~2.5k LOC)
- `team-core` (78 files, ~7.2k LOC)
- `skills-loader-core` (122 files, ~9.1k LOC)
- `lsp-core` (46 files, ~4k LOC)

## Changes Made

### Step 1: Copy source trees + fix internal imports
- Copied `packages/{mcp-client-core,team-core,skills-loader-core,lsp-core}/src/*` → `src/shared/{name}/`
- Bulk-replaced `@oh-my-opencode/` → `#shared/` within all copied files

### Step 2: Fix omo-opencode imports
- Replaced `@oh-my-opencode/mcp-client-core` → `#shared/mcp-client-core` (~14 files)
- Replaced `@oh-my-opencode/team-core` → `#shared/team-core` (~67 files)
- Replaced `@oh-my-opencode/skills-loader-core` → `#shared/skills-loader-core` (~65 files)
- lsp-core had ~0 direct importers

### Step 3: Package.json restoration
- All 4 packages already had original `package.json` (no shim modification needed)

### Step 4: Minimal package.json at `src/shared/{name}/package.json`
- Created with `type`, `name`, `main`, and `exports` replicating original subpath entries (paths adjusted to strip `./src/` prefix)

### Step 5: Vendored MCP updates
- Changed `packages/lsp-tools-mcp/package.json` lsp-core dep from `file:../lsp-core` to `file:../../src/shared/lsp-core/`
- Changed `packages/lsp-daemon/package.json` lsp-core dep similarly
- Added `imports` entry to `src/shared/lsp-core/package.json` for `#shared/mcp-stdio-core` resolution
- Updated `packages/lsp-tools-mcp/scripts/ensure-core-links.mjs` to remove obsolete junction creation
- Verified: `npm run build` succeeds for lsp-tools-mcp, lsp-daemon, and git-bash-mcp

### Step 6: Boulder-state duplicate
- Removed `packages/omo-opencode/src/features/boulder-state/` (duplicate of `src/shared/boulder-state/`)
- Updated all imports in `packages/omo-opencode/src/` from `../features/boulder-state` to `#shared/boulder-state`

### Step 7: Path aliases
- Added wildcard aliases `#shared/{name}/*` for mcp-client-core, team-core, skills-loader-core, lsp-core, boulder-state, mcp-stdio-core
- Also added aliases for pruned packages claude-code-compat-core and tmux-core (with minimal stub files)

### Step 8: Handle cross-references to pruned packages
The tier-3 packages had imports from `claude-code-compat-core` and `tmux-core` which were pruned in Phase 2 Task 1. Created minimal stub files:
- `src/shared/claude-code-compat-core/` with type definitions for `CommandDefinition`, `ClaudeCodeMcpServer`, and a self-contained `expandEnvVarsInObject` implementation
- `src/shared/tmux-core/` with stub implementations matching original function signatures

## Verification
- `bun run typecheck`: 0 errors from `src/shared/` (inlined packages pass)
- `npm run build` (lsp-tools-mcp): ✅ success
- `npm run build` (lsp-daemon): ✅ success
- `npm run build` (git-bash-mcp): ✅ success

## Concerns
1. **Pruned package stubs**: `claude-code-compat-core` and `tmux-core` were previously pruned as "dead packages" but are still referenced by the inlined tier-3 source. Created minimal stubs to satisfy typecheck, but runtime functionality (especially tmux operations) will throw errors since stubs throw. Team mode (disabled by default) is the only user of these.
2. **`@oh-my-opencode/shared-skills` import**: In skills-loader-core source, the import `@oh-my-opencode/shared-skills` is kept as-is (reverted from blanket replacement) since shared-skills is a real workspace package not being inlined.
