# Task 3 Report: Inline Tier-2 Packages

**Status:** DONE

## Commits

- `185341607` — `phase2(task3): inline tier-2 packages (rules-engine, comment-checker-core, telemetry-core, delegate-core, prompts-core, agents-md-core)`

## Summary

Inlined 6 tier-2 core packages (total ~5.9k LOC, 92 files) into `src/shared/{name}/`:

| Package | LOC (approx) | Files |
|---------|-------------|-------|
| rules-engine | ~3.1k | 44 |
| comment-checker-core | ~498 | 5 |
| telemetry-core | ~977 | 12 |
| delegate-core | ~400 | 6 |
| prompts-core | ~653 | 16 (14 src + 2 prompts/test) |
| agents-md-core | ~278 | 9 |

## Actions Taken

1. **Copied source trees** — `packages/*/src/*` → `src/shared/*/`
2. **Fixed internal imports** — replaced `@oh-my-opencode/` → `#shared/` in all copied files (12 files modified)
3. **Fixed omo-opencode imports** — replaced 6 workspace package refs → `#shared/{name}` (37 files modified)
4. **Restored original package.json** — for each of the 6 packages, reverted Task 1 re-export shims back to pre-mono-collapse originals
5. **Created minimal package.json** — at each `src/shared/{name}/package.json` with exports for subpath-exported packages (rules-engine: `./engine`, prompts-core: `./prompts/ultrawork/codex.md`)
6. **Added `#shared/utils/*` wildcard** to tsconfig paths — needed because inlined code uses subpath imports like `#shared/utils/record-type-guard`, `#shared/utils/atomic-write`, etc.
7. **Fixed pre-existing type bugs in telemetry-core** — `posthog-client.ts` was missing `TelemetryOsProvider` import; `record-daily-active.ts` was missing `createTelemetryClient`/`isTelemetryClientEnabled` imports; `CreateTelemetryClientInput.osProvider` was non-optional but usage sites passed optional
8. **Added `posthog-node`** dependency to root package.json

## Verification

- `bunx tsgo --noEmit` — **zero errors** on `src/**/*`
- `bun run typecheck` — main check passes; script tscheck fails due to script-level `@oh-my-opencode/utils` refs (pre-existing, not in scope)

## Concerns

- None. All inlined packages compile cleanly against `#shared/*` path aliases.
- Test files within `src/shared/` (`.test.ts`) were copied but excluded from typecheck via tsconfig `exclude` — they use `bun test` runtime, which handles path resolution differently.
