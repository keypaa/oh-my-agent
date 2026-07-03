# Task 5: Move omo-opencode Source to Root src/

## Scope
Move `packages/omo-opencode/src/` to root `src/`, collapsing everything under one root.

## Why
Currently:
```
src/shared/       ← inlined packages (15)
packages/omo-opencode/src/  ← actual plugin source
```

After this task:
```
src/
├── shared/       ← inlined packages (15)
├── agents/       ← moved from packages/omo-opencode/src/agents/
├── hooks/        ← moved from packages/omo-opencode/src/hooks/
├── tools/        ← moved from packages/omo-opencode/src/tools/
├── features/     ← moved from packages/omo-opencode/src/features/
├── cli/          ← moved from packages/omo-opencode/src/cli/
├── config/       ← moved from packages/omo-opencode/src/config/
├── mcp/          ← moved from packages/omo-opencode/src/mcp/
├── plugin/       ← moved from packages/omo-opencode/src/plugin/
├── plugin-handlers/  ← moved from packages/omo-opencode/src/plugin-handlers/
├── locales/      ← moved from packages/omo-opencode/src/locales/
├── generated/    ← moved from packages/omo-opencode/src/generated/
├── shared/       ← moved from packages/omo-opencode/src/shared/ (OMOPS NOTE: may conflict with root src/shared/ - handle carefully)
├── help/         ← moved from packages/omo-opencode/src/help/
├── testing/      ← moved from packages/omo-opencode/src/testing/
├── __tests__/    ← moved from packages/omo-opencode/src/__tests__/
├── index.ts      ← moved from packages/omo-opencode/src/index.ts
├── plugin-interface.ts  ← moved
└── create-{managers,tools,hooks}.ts  ← moved
```

## Steps

### Step 1: Check for conflict between root src/shared/ and packages/omo-opencode/src/shared/
Root `src/shared/` contains 15 inlined core packages.
`packages/omo-opencode/src/shared/` contains omo-opencode's own shared code (different files).
These are DIFFERENT. The move must merge them:
- `packages/omo-opencode/src/shared/*.ts` → `src/shared.plugin/` or just let them coexist by moving first then merging.

Actually, the simplest approach:
```
# Move everything EXCEPT the existing src/shared/ (which stays in place)
Get-ChildItem packages/omo-opencode/src/ -Exclude shared | ForEach-Object {
    Move-Item $_.FullName src/ -Force
}
# Then merge the omo-opencode shared files into root src/shared/
# Since packages/omo-opencode/src/shared/ contains files like logger.ts, data-path.ts, etc.
# that are DIFFERENT from src/shared/utils/, src/shared/model-core/, etc., they'll coexist.
Move-Item packages/omo-opencode/src/shared/* src/shared/ -Force
```

Actually, there's a risk: `packages/omo-opencode/src/shared/` has files like `logger.ts`, `data-path.ts`, `connected-providers-cache.ts` at the TOP level, while root `src/shared/` has SUBDIRECTORIES (`utils/`, `model-core/`, etc.). These are DIFFERENT SCOPE and won't conflict. So merging is safe.

BUT there may be files with the SAME NAME in both. Check for conflicts:
```
Get-ChildItem -Recurse packages/omo-opencode/src/shared/*.ts | ForEach-Object {
    $name = $_.Name
    $conflict = Get-ChildItem -Recurse src/shared/$name
    if ($conflict) { Write-Output "CONFLICT: $name" }
}
```

### Step 2: Update build entry in package.json
Change `packages/omo-opencode/src/index.ts` → `src/index.ts` in the build script.

### Step 3: Clean up packages/omo-opencode/ (empty after move)
Remove `packages/omo-opencode/` after the move is complete.

### Step 4: Verify typecheck
```bash
tsgo --noEmit -p tsconfig.json
```
The `include: ["src/**/*"]` should now cover EVERYTHING except scripts/. Expect zero errors on `src/**/*`.

### Step 5: Verify vendored MCPs still build
```bash
cd packages/lsp-tools-mcp && npm run build | tail -3
cd packages/lsp-daemon && npm run build | tail -3
cd packages/git-bash-mcp && npm run build | tail -3
```

### Step 6: Commit
```bash
git add -A && git commit -m "phase2(task5): move plugin source to root src/"
```

## Global Constraints
- Preserve git history — use Move-Item (rename), not copy-then-delete
- Root `src/shared/` (15 inlined packages) stays in place, DON'T overwrite
- `packages/omo-opencode/src/shared/` has omo-opencode's utility files — merge into `src/shared/` (they're at the top level, not in subdirs, so no name conflicts with `src/shared/{utils,model-core,...}` SUBDIRECTORIES)
- After the move, the remaining `packages/` dir should only contain vendored MCPs + re-export shim dirs
