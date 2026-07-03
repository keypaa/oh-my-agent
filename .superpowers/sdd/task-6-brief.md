# Task 6: Fix Type Regressions + Final Verification

## Scope
Fix all 174 type errors across `src/` and run full verification suite.

## Error Breakdown

| Code | Count | Pattern |
|------|-------|---------|
| TS2307 | 68 | `Cannot find module '#shared/{name}/...'` — missing wildcard path aliases |
| TS2305 | 93 | `Module has no exported member 'X'` — inlined packages missing exports |
| TS7006 | 6 | Parameter implicitly 'any' |
| TS2345 | 5 | Argument type mismatch |
| TS2322 | 2 | Type not assignable |

## Fix Strategy

### Part 1: Add missing wildcard path aliases (TS2307)
Many imports use subpaths like `#shared/skills-loader-core/builtin-skills/skills/...`. These need `#shared/{name}/*` → `./src/shared/{name}/*` entries in tsconfig paths.

Run `bun run typecheck 2>&1 | Select-String "TS2307" | ForEach-Object { $_ -match "'#shared/([^/]+)" | ... }` to identify which packages need wildcard aliases, then add them.

### Part 2: Fix missing exports (TS2305)
Many errors are relative-path imports (e.g., `../../features/opencode-skill-loader/types`) where the moved source expects specific exports that don't exist.

For each TS2305 error, check if:
- The export name changed during inlining (e.g., function was renamed)
- The file was moved and the relative path is now wrong
- The package's `index.ts` changed its re-export structure

Fix each by either:
- Updating the import to match the actual export name
- Adding the missing export to the barrel `index.ts`
- Changing to the correct relative path

### Part 3: Verify
```bash
bun run typecheck
```
Must be zero errors.

### Part 4: Full build + test
```bash
bun run build
bun test | Select-String "pass|fail|error"
```

### Part 5: Commit
```bash
git add -A && git commit -m "phase2(task6): fix type regressions and finalize inlining"
```

## Global Constraints
- Fix the root cause, not symptoms — add wildcard aliases instead of changing every import
- Don't modify test assertions or remove tests to make things pass
- Keep vendored MCPs building
