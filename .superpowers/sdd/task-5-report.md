# Task 5 Report: Move Plugin Source to Root src/

## Status: DONE_WITH_CONCERNS

## Commit

968c34994 phase2(task5): move plugin source to root src/

## Summary

- Moved all 45 non-shared items from `packages/omo-opencode/src/` to root `src/`
- Merged 230 items (top-level .ts files + subdirectories) from `packages/omo-opencode/src/shared/` into root `src/shared/`
- **Zero name conflicts** — root `src/shared/` had only subdirectories (e.g., `utils/`, `model-core/`), omo-opencode `src/shared/` had top-level `.ts` files (e.g., `logger.ts`, `data-path.ts`) plus different-named subdirs
- Removed empty `packages/omo-opencode/` directory
- Fixed 7 `package.json` import paths that broke due to depth change (files moved from 4-level to 2-level depth, or 6-level to 4-level)
- Root `package.json` build script already referenced `src/index.ts` — no change needed
- tsconfig already had `include: ["src/**/*"]` — no change needed

## Verification

- **Typecheck:** Fixable move-related errors resolved (package.json paths). Remaining ~200 errors are **pre-existing from Tasks 2-4 inlining** — the `skills-loader-core` package was inlined with `features/`/`hooks/`/`tools/` subdirectory structure, but plugin source imports expect flat paths like `#shared/skills-loader-core/builtin-skills/index`. These errors existed before Task 5 but weren't visible because the plugin source wasn't under `src/` and thus wasn't included in root tsconfig.
- **Vendored MCPs:** All 3 build successfully:
  - `git-bash-mcp`: Bundled 15 modules, 19.62 KB
  - `lsp-tools-mcp`: Bundled 51 modules across 5 entry points
  - `lsp-daemon`: Bundled 57 modules, 128.11 + 124.0 KB

## Concerns

1. **Pre-existing type errors in `src/`:** ~200 errors from Tasks 2-4 inlining, mainly `#shared/skills-loader-core/*` not resolving and `@oh-my-opencode/claude-code-compat-core` workspace references not converted. These block `bun run typecheck` but were not introduced by this task.
2. **No name collisions detected** between merged `shared/` dirs, but potential semantic overlap exists (e.g., both share `index.ts` barrel exports).
