# Task 3: Inline Tier-2 Packages

## Scope
Inline **6 tier-2 core packages** that depend on already-inlined packages:

1. `rules-engine` (~3.1k LOC, 44 files) — depends on utils
2. `comment-checker-core` (~498 LOC, 5 files) — depends on utils
3. `telemetry-core` (~977 LOC, 12 files) — depends on utils
4. `delegate-core` (~400 LOC, 6 files) — depends on model-core
5. `prompts-core` (~653 LOC, 14 files) — depends on model-core, utils
6. `agents-md-core` (~278 LOC, 9 files) — depends on rules-engine

## Steps

### Step 1: Copy source trees + fix internal imports
For each package, copy `packages/{name}/src/*` to `src/shared/{name}/`, then fix `@oh-my-opencode/` → `#shared/` within all `src/shared/{name}/` files.

Use a script or function to avoid repetition:
```pwsh
$tier2 = @('rules-engine','comment-checker-core','telemetry-core','delegate-core','prompts-core','agents-md-core')
foreach ($pkg in $tier2) {
    Copy-Item -Recurse "packages/$pkg/src/*" "src/shared/$pkg/"
}
```

Then within `src/shared/*/`, bulk-replace `@oh-my-opencode/` with `#shared/`.

### Step 2: Fix omo-opencode imports
In `packages/omo-opencode/src/`, bulk-replace each old workspace package reference:
- `@oh-my-opencode/rules-engine` → `#shared/rules-engine` (~19 files)
- `@oh-my-opencode/comment-checker-core` → `#shared/comment-checker-core` (~3 files)
- `@oh-my-opencode/telemetry-core` → `#shared/telemetry-core` (~6 files)
- `@oh-my-opencode/delegate-core` → `#shared/delegate-core` (~4 files)
- `@oh-my-opencode/prompts-core` → `#shared/prompts-core` (~9 files)
- `@oh-my-opencode/agents-md-core` → `#shared/agents-md-core` (~3 files)

### Step 3: Verify
```bash
tsgo --noEmit
```
Must be zero errors on `src/shared/**/*`. Vendored MCP builds should still work.

### Step 4: Commit
```bash
git add -A && git commit -m "phase2(task3): inline tier-2 packages"
```

## Global Constraints
- `#shared/{name}` → `src/shared/{name}/index.ts` path alias already in tsconfig
- Restore original `package.json` for each inlined package (revert the re-export shim from Task 1)
- Vendored MCPs don't reference these packages, so no vendored dep updates needed
- Each `src/shared/{name}/` needs a minimal `package.json` (`{ "type": "module", "name": "@oh-my-opencode/{name}", "main": "index.ts" }`) for `file:` dep compatibility
- Keep original source at `packages/{name}/src/` for now (don't delete — will be removed in Task 5)
