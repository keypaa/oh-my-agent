# Task 4: Inline Tier-3 Packages + Vendored MCP Updates

## Scope
Inline **4 tier-3 core packages** plus update vendored MCP `file:` deps.

1. `mcp-client-core` (~2.5k LOC, 30 files) — depends on utils (inlined Task 2)
2. `team-core` (~7.1k LOC, 78 files) — depends on utils (inlined Task 2)
3. `skills-loader-core` (~9k LOC, 122 files) — depends on model-core, utils (both inlined)
4. `lsp-core` (~4k LOC, 46 files) — depends on mcp-stdio-core (inlined Task 2)

**Important:** lsp-core is consumed by vendored MCP builds. After inlining, update those deps.

## Steps

### Step 1: Copy source trees + fix internal imports
For each package, copy `packages/{name}/src/*` to `src/shared/{name}/`, then fix `@oh-my-opencode/` → `#shared/` within all `src/shared/{name}/` files.

```pwsh
$tier3 = @('mcp-client-core','team-core','skills-loader-core','lsp-core')
foreach ($pkg in $tier3) { Copy-Item -Recurse "packages/$pkg/src/*" "src/shared/$pkg/" }
```

Then within `src/shared/*/`, bulk-replace `@oh-my-opencode/` with `#shared/`.

### Step 2: Fix omo-opencode imports
In `packages/omo-opencode/src/`, bulk-replace each old workspace package reference:
- `@oh-my-opencode/mcp-client-core` → `#shared/mcp-client-core` (~14 files)
- `@oh-my-opencode/team-core` → `#shared/team-core` (~75 files)
- `@oh-my-opencode/skills-loader-core` → `#shared/skills-loader-core` (~65 files)
- lsp-core has ~0 omo-opencode importers — skip

### Step 3: Restore original package.json
For each of the 4 packages, restore original `package.json` (Task 1 re-export shim revert).
```bash
git show HEAD~1:packages/{name}/package.json > packages/{name}/package.json
```
EXCEPT lsp-core — its package.json was already restored in Task 2 with mcp-stdio-core dep fixed to `file:../../src/shared/mcp-stdio-core`. Keep that.

### Step 4: Create minimal package.json at `src/shared/{name}/package.json`
```json
{ "type": "module", "name": "@oh-my-opencode/{name}", "main": "index.ts" }
```
Check if the ORIGINAL package.json has `exports` with subpath entries — if so, replicate them in the minimal version with adjusted paths (no `./src/` prefix since source is flat at `src/shared/{name}/`).

### Step 5: Fix vendored MCP references
After lsp-core is inlined, update the vendored MCPs that reference it:

`packages/lsp-tools-mcp/package.json`:
- Change `"@oh-my-opencode/lsp-core": "file:../lsp-core"` to `"file:../../src/shared/lsp-core/"`

`packages/lsp-daemon/package.json`:
- Change `"@oh-my-opencode/lsp-core": "file:../lsp-core"` to `"file:../../src/shared/lsp-core/"`

Also update `packages/lsp-tools-mcp/scripts/ensure-core-links.mjs` — the script creates a junction for lsp-core's mcp-stdio-core dep, but lsp-core no longer needs mcp-stdio-core junction after inlining (source is at `src/shared/lsp-core/`, dep is handled by npm's file:).

### Step 6: Handle boulder-state duplicate
`packages/omo-opencode/src/features/boulder-state/` is a DUPLICATE of the already-inlined `packages/boulder-state/` → `src/shared/boulder-state/`. Remove the feature-level duplicate. Update any imports referencing it.

### Step 7: Verify
```bash
# Typecheck src/shared/
tsgo --noEmit -p tsconfig.json
# vendored MCP builds
cd packages/lsp-tools-mcp && npm run build | tail -5
cd packages/lsp-daemon && npm run build | tail -5
cd packages/git-bash-mcp && npm run build | tail -5
```

### Step 8: Commit
```bash
git add -A && git commit -m "phase2(task4): inline tier-3 packages, update vendored MCP references"
```

## Global Constraints
- `#shared/{name}` → `src/shared/{name}/index.ts` path alias already in tsconfig for all 4
- `#shared/utils/*` wildcard already added (Task 3 implementer) — may need similar for other packages if subpath imports exist
- After inlining lsp-core, vendored MCPs must be rebuilt and verified
- Keep original source at `packages/{name}/src/` for now (will remove in Task 5)
- The boulder-state duplicate in packages/omo-opencode/src/features/boulder-state/ must be handled
