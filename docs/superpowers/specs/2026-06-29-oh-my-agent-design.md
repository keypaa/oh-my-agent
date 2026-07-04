# Design Doc: oh-my-agent

**Date:** 2026-06-29
**Status:** DRAFT
**Based on:** oh-my-openagent v4.14.0 + superpowers v6.0.3

---

## 1. Overview

A new OpenCode plugin that preserves oh-my-openagent's 11-agent system, MCP infrastructure, and hook architecture while stripping Codex compatibility, openclaw, tmux, and other unused features. Deeply integrates superpowers skills into agent behavior, adds 4 new agents (the-auditor, ML/AI Engineering, Haruspex, Cold-Eyes), replaces the boulder forced-continuation with an audit-loop, and ships as a single npm package with one-command install for "retrouver mes petits."

---

## 2. Project Structure

Single npm package, no monorepo.

```
oh-my-agent/
├── src/
│   ├── index.ts                        # Plugin entry (simplified createPluginModule)
│   ├── plugin-interface.ts             # 12 OpenCode hook handlers (no CC compat)
│   ├── agents/
│   │   ├── sisyphus/                   # Main orchestrator (primary)
│   │   ├── hephaestus/                 # Deep worker (primary)
│   │   ├── atlas/                      # Orchestrator (primary)
│   │   ├── prometheus/                 # Strategic planner (primary)
│   │   ├── sisyphus-junior/            # Category executor (subagent)
│   │   ├── oracle/                     # Read-only consultant (subagent)
│   │   ├── librarian/                  # Doc search (subagent)
│   │   ├── explore/                    # Codebase exploration (subagent)
│   │   ├── multimodal-looker/          # Image analysis (subagent)
│   │   ├── metis/                      # Pre-planning consultant (subagent)
│   │   ├── momus/                      # Plan reviewer (subagent)
│   │   ├── the-auditor/                # Work verifier (all) — mode: "all"
│   │   ├── ml-ai-engineering/          # ML/AI specialist (all) — mode: "all"
│   │   ├── haruspex/                   # Harness maintainer (subagent)
│   │   ├── cold-eyes/                  # Unbiased second verifier (subagent)
│   │   ├── builtin-agents/             # Agent registry
│   │   ├── agent-builder.ts
│   │   ├── dynamic-agent-prompt-builder.ts
│   │   └── types.ts
│   ├── hooks/
│   │   ├── session/                    # ~20 session hooks (no CC hooks)
│   │   ├── tool-guard/                 # ~15 tool guard hooks (no CC hooks)
│   │   ├── transform/                  # 3 transform hooks (keywordDetector, contextInjector, toolPairValidator)
│   │   ├── continuation/               # 6 continuation hooks (stopGuard, compaction, babysitter, auditLoop, notification, atlas)
│   │   └── skill/                      # 2 skill hooks (categorySkillReminder, autoSlashCommand)
│   ├── tools/                          # grep, glob, session, background, call-omo-agent, delegate-task, skill, skill-mcp, slashcommand, interactive-bash, look-at, hashline-edit, task-system
│   ├── features/
│   │   ├── team-mode/                  # KEPT (optional, 13k LOC)
│   │   ├── background-agent/           # KEPT
│   │   ├── opencode-skill-loader/      # KEPT (opencode-skill-loader)
│   │   ├── builtin-skills/             # KEPT
│   │   ├── skill-mcp-manager/          # KEPT
│   │   ├── tool-metadata-store/        # KEPT
│   │   ├── context-injector/           # KEPT
│   │   ├── hook-message-injector/      # KEPT
│   │   ├── run-continuation-state/     # KEPT (~50 LOC)
│   │   ├── opencode-runtime-skills/    # KEPT
│   │   ├── task-toast-manager/         # KEPT
│   │   ├── session-state/              # RENAMED from claude-code-session-state
│   │   └── skill-command-registrar/    # NEW — auto-registers /commands from SKILL.md frontmatter
│   ├── config/
│   │   ├── schema/                     # Zod schemas (removed CC, openclaw, tmux, mcp-oauth)
│   │   ├── validate.ts
│   │   └── index.ts
│   ├── cli/
│   │   ├── install.ts                  # Setup wizard
│   │   ├── run/                        # Session launcher
│   │   ├── doctor/                     # Health diagnostics
│   │   ├── config-export.ts            # NEW: export/import config profiles
│   │   ├── version.ts
│   │   └── refresh-model-capabilities.ts
│   ├── mcp/                            # 5 built-in MCPs (same as omo)
│   ├── plugin/                         # Hook handlers + composition (simplified)
│   ├── plugin-handlers/                # Config loading pipeline (5 phases, no CC)
│   ├── shared/                         # Cross-cutting utilities (from omo)
│   ├── locales/                        # 16 toast strings (kept)
│   └── generated/                      # model-capabilities.generated.json
├── install.sh                          # NEW: one-command install
├── customize-oma.skill.md              # NEW: skill doc for configuring oh-my-agent
└── package.json                        # Single package, no monorepo

CUT from omo:
- packages/ directory (entire monorepo — inline kept packages)
- packages/omo-codex/ (Codex Light edition)
- All packages/*-core/ (inline into src/shared/ or features/)
- Platform binaries (12 oh-my-opencode-* packages)
- openclaw/ + openclaw-core/
- claude-code-*-loader features
- claude-code-hooks hook
- claude-tasks feature
- monitor feature
- tui-sidebar feature
- tmux-subagent feature
- mcp-oauth feature + CLI command
- boulder-state feature + boulder CLI command
- model-requirements (per-agent model chains)
- ulw-loop CLI (rewrite later) REALLY IMPORTANT 
- sparkshell CLI
- get-local-version CLI
- cleanup/uninstall CLI
```

---

## 3. Agent System

### 15 Agents

| # | Agent | Mode | Role | Source |
|---|-------|------|------|--------|
| 1 | Sisyphus | primary | Main orchestrator — plans, delegates, drives work | omo |
| 2 | Hephaestus | primary | Autonomous deep worker (GPT variants) | omo |
| 3 | Atlas | primary | Todo-list orchestrator for work tracking | omo |
| 4 | Prometheus | primary | Strategic planner — interview mode | omo |
| 5 | Sisyphus-Junior | subagent | Category-spawned executor | omo |
| 6 | Oracle | subagent | Read-only consultant (no write/edit) | omo |
| 7 | Librarian | subagent | External doc & code search | omo |
| 8 | Explore | subagent | Codebase exploration | omo |
| 9 | Multimodal-Looker | subagent | PDF/image analysis | omo |
| 10 | Metis | subagent | Pre-planning consultant (temp 0.3) | omo |
| 11 | Momus | subagent | Plan reviewer | omo |
| 12 | the-auditor | **all** | Work verifier — checks output vs spec | NEW |
| 13 | ML/AI Engineering | **all** | ML/AI specialist — HF ml-intern prompts | NEW |
| 14 | Haruspex | subagent | Harness maintainer — manages skills, config, docs | NEW |
| 15 | Cold-Eyes | subagent | Unbiased second verifier — sanitized context, no contamination | NEW |

### Model Handling

No per-agent model requirements in code. Agents inherit the caller's model by default. Optional override in config:

```jsonc
{
  "agents": {
    "sisyphus": { "model": "claude-opus-4-7" },
    "ml-ai-engineering": { "model": "gpt-5-5" },
    "explore": { "model": null }  // explicit inherit
  }
}
```

Model fallback (when primary model fails) uses a single configurable chain, not per-agent chains.

### Execution Sandbox

Hephaestus and Sisyphus-Junior can execute code via the `interactive_bash` tool. This tool must have:

| Feature | Default | Configurable |
|---------|---------|-------------|
| Timeout per command | 120s | `interactive_bash.timeout_seconds` |
| Max output size | 10 MB | `interactive_bash.max_output_bytes` |
| Working directory restricted to project root | ✅ | Hard-coded (not configurable) |
| Network access for test commands | Allowed | `interactive_bash.allow_network` |

The `interactive_bash` tool captures stdout, stderr, and exit code. On non-zero exit, the agent retries automatically (up to 3 attempts) with the error output as context. This is already the behavior of omo's existing `interactive_bash` — the spec adds explicit documentation of the sandbox guarantees.

### ML/AI Engineering Skill Pack

Six new skills purpose-built for ML/AI work, authored by Haruspex using the `writing-skills` superpowers skill and maintained alongside the agent. They guard against the most common failure modes models exhibit when doing ML (parameter guesswork, silent metric drift, data leakage, irreproducible experiments).

**experiment-tracking** — Log all experiment parameters, metrics, and artifacts to a tracker (wandb / MLflow / tensorboard). Never train a model without logging. Every training run must produce a reproducible record: hyperparams, commit hash, dataset version, metrics, environment.

**data-pipeline-hygiene** — Check for train/test leakage before any training run. Validate data schema and distribution before fitting. Alert on covariate shift between train and inference data. Never train on uncleaned or unvalidated data.

**reproducible-training** — Set random seeds (Python, NumPy, PyTorch, TF) before every training run. Pin dependency versions (requirements.txt or environment.yml). Record training environment (CUDA version, driver, GPU model). Never train without a seed set.

**hyperparameter-discipline** — Use structured search (grid, random, Bayesian via Optuna/Ray Tune) for hyperparameter selection. Record all trials with their metrics. Never guess a learning rate or batch size — justify or search.

**evaluation-integrity** — Use the correct metric for the task (not accuracy for imbalanced classification). Stratified train/test splits. Report confidence intervals, not point estimates. Never evaluate on data that influenced model development (no test set leakage, no data peeking).

**model-surgery-safety** — When fine-tuning, quantizing, pruning, or distilling: validate output distribution before/after the change. Check that the intervention doesn't break downstream metrics. Run a comparison eval (paired or A/B). Never apply model surgery without a before/after eval.

These skills live in `src/features/builtin-skills/skills/ml-ai/` alongside the other built-in skills. They are auto-discovered by `skill-command-registrar` and get `/` commands like any superpowers skill. Haruspex references them in `customize-oma.skill.md`.

---

## 4. Superpowers Integration

### Skill-Agent Mapping
Each agent's prompt references relevant superpowers skills via the dynamic `skill-manifest.json`:

| Agent | Key Skills |
|-------|-----------|
| Sisyphus | brainstorming, writing-plans, subagent-driven-development, TDD |
| Hephaestus | TDD, systematic-debugging, verification-before-completion |
| Atlas | writing-plans, dispatching-parallel-agents, subagent-driven-development |
| Prometheus | writing-plans |
| Sisyphus-Junior | TDD, verification-before-completion |
| the-auditor | verification-before-completion, receiving-code-review |
| ML/AI Engineering | experiment-tracking, data-pipeline-hygiene, reproducible-training, hyperparameter-discipline, evaluation-integrity, model-surgery-safety |
| Haruspex | writing-skills (meta — for creating new skills) |

### `/command` Auto-Registration (skill-command-registrar)

At plugin init, reads all superpowers SKILL.md YAML frontmatter:

```yaml
---
name: brainstorming
triggers: [brainstorm, design, spec, architecture]
---
```

→ Auto-registers `/brainstorm`, `/design`, `/spec`, `/architecture` as OpenCode commands. Each command invokes the `skill` tool with the matching skill.

The registrar watches for new skills added by Haruspex and hot-reloads. Commands are discoverable via `/help` and the `slashcommand` tool.

### Trigger Conflict Resolution

If two SKILL.md files declare the same trigger (e.g., two skills claiming `design`):

1. **Priority order**: Project `.opencode/skills/` > user `~/.config/oh-my-agent/skills/` > system installed superpowers skills
2. **Warning on conflict**: At plugin init, conflicting triggers are logged. The higher-priority skill wins. The lower-priority skill's command is still accessible via `/skill:{name}` (fully qualified).
3. **User override**: Config can explicitly map a trigger to a specific skill: `{"command_triggers": {"design": "brainstorming"}}`

### Skill Discovery

Install flow clones superpowers to `~/.config/oh-my-agent/skills/`. The `opencode-skill-loader` searches this path plus `.opencode/skills/` and `.agents/skills/` for project-level overrides.

---

## 5. Audit-Loop (boulder replacement)

Inspired by superpowers' `subagent-driven-development` two-stage review pattern.

```
Agent works until it claims completion
        ↓
session.idle event fires
        ↓
auditContinuationHook checks: did the agent claim completion?
        ↓
[STEP 1] Spawn Verifier 1: the-auditor
  Context: original task + agent's claims + changed files + plan
  Checks: code matches spec? Any stubs? Tests pass? Any hallucinations?
        ↓
[STEP 2] Spawn Verifier 2: Cold-Eyes
  Context: ONLY original task + changed files (SANITIZED)
  NO exposure to agent's self-report or Verifier 1's findings
  "Avoir la tête froide" — catches contamination, shared blind spots
        ↓
Both approve? → Normal completion flow
Either flags issues? → Present both reports to user:
  "Verifier 1 found X issues. Verifier 2 found Y issues.
   Continue? [Y/n] (Attempt N/3)"
        ↓
User says yes → Agent resumes with both reports as context
User says no → Session ends, user reviews manually
        ↓
**Circuit breaker:** After N consecutive audit→fix→audit cycles (configurable, default 3), the loop escalates to **mandatory human review**. The user must explicitly override to continue beyond the limit. Prevents the same boulder adversarial dynamic (models ticking todos to stop the hammer) from re-emerging in audit-loop form.
```

Verifier 2's sanitized context is key: by hiding the agent's claims and Verifier 1's report, it avoids anchoring bias. This catches cases where both the agent and first verifier share the same hallucination (e.g., "this is how DeepSeek V4 works" — both are wrong, but neither knows it).

---

## 6. Haruspex — Harness Maintenance Agent

A `mode: "subagent"` agent dedicated to maintaining the oh-my-agent plugin itself.

**System prompt includes:**
- Complete project structure (which files do what)
- Superpowers SKILL.md format reference
- How to add a new skill: create SKILL.md, register in manifest, add `/command` mapping
- How the agent prompt system works (dynamic prompts, `skill-manifest.json`)
- How the config schema works (Zod v4, which files to modify)

**Triggers:**
- User: "add a new skill for X" → Sisyphus spawns Haruspex
- User: "how do I customize Y?" → Haruspex reads current state and explains
- After any agent updates a skill or config: Haruspex auto-updates `customize-oma.skill.md`
- Session start: Haruspex checks if `customize-oma.skill.md` is stale and regenerates if needed

**Interaction with customize-oma.skill.md:**

`customize-oma.skill.md` (a superpowers-format skill doc) is the living documentation for the plugin. Haruspex updates it whenever the harness changes — new skills added, config schema modified, agents added/removed. When the user loads `customize-oma`, it tells them:
- What skills are available
- How to add/remove skills
- How to configure agents
- How to export/import config profiles
- What the current plugin version is and what changed
- How confidential file guard, secret scanner, and provenance guard work
- How the failure journal works and how to query it
- How cost tracking and model tiering work

This creates a self-documenting system: the agent that knows the harness best maintains the docs, and the docs are always accurate because they're generated from live state, not stale prose.

### Self-Modification Guard

Haruspex can modify its own docs and skill files, but changes to sensitive paths require user confirmation:

| Path scope | Allowed without confirmation | Requires user confirmation |
|------------|---------------------------|---------------------------|
| `customize-oma.skill.md` | ✅ Yes (pure doc) | — |
| `src/features/*/` (new features added) | — | ✅ Must show diff |
| `src/agents/*/` (agent prompts) | — | ✅ Must show diff (primary agents blocked, subagents warned) |
| `src/config/schema/` (Zod config) | — | ✅ Hard block — user must type `y` explicitly |
| `src/hooks/*/` | — | ✅ Must show diff |
| `install.sh` | — | ✅ Hard block |

Implementation: Haruspex's `Write`/`Edit` tool calls are intercepted by a `haruspex-guard` Tool Guard hook that checks target path against the scope table. If blocked, the hook returns an error: "Modification of {path} requires user confirmation. Run with `--confirm` or make the change manually."

---

## 7. One-Command Install & Config Export

Cross-platform: bash for Unix, PowerShell for Windows. Both scripts do the same thing — detect platform, install, configure.

### `install.sh` (Unix — Linux / macOS)

```bash
curl -fsSL https://github.com/user/oh-my-agent/install.sh | bash
# or with config profile:
curl -fsSL https://github.com/user/oh-my-agent/install.sh | bash -s -- --config ~/dotfiles/oma-profile.jsonc
```

Steps:
1. Detect OS/arch (Linux x64/arm64, macOS x64/arm64)
2. `npm install -g oh-my-agent`
3. Clone superpowers skills to `~/.config/oh-my-agent/skills/`
4. If `--config` provided: import profile (provider keys, agent overrides, skill selections)
5. If no `--config`: run interactive install wizard
6. Run `oh-my-agent doctor` to verify
7. Print "oh-my-agent installed. Run `oh-my-agent help` to get started."

### `install.ps1` (Windows)

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-Expression (Invoke-WebRequest -Uri "https://github.com/user/oh-my-agent/install.ps1" -UseBasicParsing).Content
# or with config profile:
.\install.ps1 -ConfigPath "$env:USERPROFILE\dotfiles\oma-profile.jsonc"
```

Steps:
1. Detect Windows version + architecture (x64, arm64)
2. Verify prerequisites: Node.js (via winget or nvm-windows check), Git (via `winget install --id Git.Git` if missing — same preflight as omo's Codex installer)
3. `npm install -g oh-my-agent`
4. Clone superpowers skills to `$env:APPDATA\oh-my-agent\skills\`
5. If `-ConfigPath` provided: import profile
6. If no config: run interactive install wizard (via @clack/prompts — same TUI as Unix, works in PowerShell)
7. Run `oh-my-agent doctor` to verify
8. Print "oh-my-agent installed. Run `oh-my-agent help` to get started."

Path differences (handled by the script):

| Purpose | Unix | Windows |
|---------|------|---------|
| Config directory | `~/.config/oh-my-agent/` | `$env:APPDATA\oh-my-agent\` |
| Skills directory | `~/.config/oh-my-agent/skills/` | `$env:APPDATA\oh-my-agent\skills\` |
| Failure journal | `~/.config/oh-my-agent/failure-journal.jsonl` | `$env:APPDATA\oh-my-agent\failure-journal.jsonl` |
| Home expansion | `~` | `$env:USERPROFILE` |

### `oh-my-agent config export`

Writes current effective config to stdout or file:

```bash
oh-my-agent config export --output ~/dotfiles/oma-profile.jsonc
oh-my-agent install --config ~/dotfiles/oma-profile.jsonc  # on new machine
```

The exported file:
- Strips secrets (prompts user to re-enter API keys)
- Template-izes paths (`{homeDir}`, `{os}`, `{arch}`) so they resolve correctly on different machines
- Includes: provider configurations, agent overrides, skill selections, disabled features, MCP settings

---

## 8. CLI Commands (final)

| Command | Description |
|---------|-------------|
| `install` | Setup wizard (interactive or `--config`) |
| `run <message>` | Non-interactive headless session |
| `doctor` | Health diagnostics |
| `version` | Print plugin version |
| `refresh-model-capabilities` | Refresh models.dev cache |
| `config export` | Export current config as portable profile |
| `cost` | Show token/cost usage per agent and session |
| `journal` | List/search/clear failure journal entries |

**CUT from omo:** `mcp-oauth`, `boulder`, `cleanup/uninstall`, `sparkshell`, `ulw-loop` (rewrite later), `get-local-version`

---

## 9. Confidential File Guard

A new Tool Guard hook that prevents agents from reading confidential files across ALL tools.

### Configuration

```jsonc
{
  "confidential_files": {
    "enabled": true,
    "paths": [".env", ".env.*", "**/secrets/**", "**/*.pem", "**/credentials.json", "**/service-account.json"],
    "block_message": "Access to '{path}' is blocked by security policy."
  }
}
```

Default paths focus on credentials and secrets. Users can add project-specific patterns.

### Blocked Vectors

| Tool | What is blocked | Mechanism |
|------|----------------|-----------|
| **Read** | File path matches any blocked glob pattern | Hard block before execute: `output.error = "..."` |
| **Glob** | Result set contains a blocked file | Filter results — blocked files are silently removed from output |
| **Grep** | Search targets a blocked file path | Hard block before execute |
| **Bash: read commands** | `cat`, `head`, `tail`, `more`, `less`, `type`, `Get-Content`, `findstr`, `Select-String` with blocked path | Regex on command string before execute |
| **Bash: env dump** | `printenv`, `env`, `set` | Hard block — prevents dumping all env vars (which includes secrets) |
| **Bash: git leaks** | `git show`, `git diff`, `git log -p` referencing a blocked file | Path-in-diff check before execute |
| **Bash: copy/exfil** | `cp`, `scp`, `rsync`, `curl`, `wget` with blocked path as source | Regex on command string |
| **Bash: source/sourcing** | `. .env`, `source .env` | Regex on command string |
| **Bash: wildcard reads** | `cat .*`, `cat *`, `type *` (suspicious broad reads) | Heuristic — flags low-confidence patterns with a warning |
| **LSP** | `lsp_diagnostics` on a blocked file | Block before execute |
| **Webfetch** | Uploading blocked file content to an external URL | Block if the tool call references a blocked path in its arguments |

### Block Behavior

Not a warning — a **hard block**. The model sees:

```
Error: Access to '.env' is blocked by oh-my-agent security policy.
```

No content, no hints about what's inside. The model cannot learn from the block message itself.

### Implementation Notes

- Pattern matching uses minimatch or micromatch for glob support (same as omo's existing file utilities)
- Bash regex patterns cover both Unix (`cat`, `head`, `tail`) and Windows/PowerShell (`type`, `Get-Content`, `findstr`) commands
- Environment variable dumps (`printenv`, `env`) are blocked entirely because .env values are loaded into the environment
- Absorbs and replaces the existing `bash-file-read-guard.ts` (which only warns on `cat`/`head`/`tail`)

---

## 10. Secret Scanner (tool-guard hook)

Symmetrical to Confidential File Guard: that one blocks **reading** secrets from files. This one blocks **writing** secrets into files. Both are needed — a secret can leak on write (commit) or on read (exfil).

```
src/hooks/secret-scanner/
├── index.ts              # hook handler
├── patterns.ts           # regex patterns + entropy check
└── patterns.test.ts
```

### Detection

Two-layer detection:

1. **Known patterns** — regex for common secret formats:
   - `AKIA[0-9A-Z]{16}` (AWS Access Key)
   - `sk-[a-zA-Z0-9]{20,}` (OpenAI)
   - `sk-ant-[a-zA-Z0-9-]{20,}` (Anthropic)
   - `gh[pousr]_[A-Za-z0-9]{36,}` (GitHub tokens)
   - `-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----`
   - `.env` assignment with value: `KEY|SECRET|TOKEN|PASSWORD\s*=\s*['"]?[^\s'"]{8,}`

2. **Entropy heuristic** — for secrets without known patterns: strings ≥32 chars with Shannon entropy > 4.0 are flagged. Catches custom API keys, ad-hoc tokens, etc.

### Hook behavior

| Event | What is checked | Action |
|-------|----------------|--------|
| `Write`/`Edit` tool | File content before write | Scan content for patterns + entropy. **Block** on severity "block". **Warn** on "warn". |
| `Bash: git commit` | Git diff or staged content | Scan for secrets in the diff. Block commit if found. |
| `Bash: cp/scp/curl` to external destination | Source file path + content | Block if source is a blocked pattern file or content has secrets. |

### Severity levels

- **`block`** — Known credential formats (AWS keys, API keys, private keys). Hard error before write. Secret never touches disk.
- **`warn`** — Entropy hits, generic bearer tokens, `.env` key=value patterns. Warning to the model, but allows proceed. User-configured threshold.

### Allowlist

Per-file and per-pattern allowlists in config:

```jsonc
{
  "secret_scanner": {
    "enabled": true,
    "allowlist_patterns": ["test-*", "**/fixtures/**"],
    "allowlist_paths": ["**/*.test.ts", "**/*.md"]
  }
}
```

### Integration with git guard

The `Bash: git commit` check is critical — a secret written by an external tool (IDE, manual edit) would bypass the Write/Edit hook but still get caught at commit time. The hook parses `git diff --cached` and scans for patterns before allowing the commit command.

---

## 11. Provenance Guard (skill-mcp-manager / Haruspex)

Any code that installs a skill or MCP from an external source is an attack vector. Malicious skills can inject prompts, exfiltrate data, modify files.

### What it guards

| Entry point | Risk |
|-------------|------|
| Haruspex adding a new skill | Malicious SKILL.md with prompt injection |
| skill-mcp-manager connecting to a new MCP server | MCP server returns poisoned tool responses |
| User running `oh-my-agent install --skill <url>` | Skill from untrusted source |
| Skill-command-registrar discovering a new SKILL.md | Skill planted in `.opencode/skills/` by another agent |

### Checks before any install

1. **Source verification**: Is the source a known registry (superpowers official, verified GitHub org)? If not, warn the user explicitly.
2. **Repo age/stars heuristic**: GitHub repo <30 days old with <10 stars → flag as high-risk. User must confirm.
3. **Content scan**: SKILL.md is scanned by the Secret Scanner before being read into memory.
4. **Permission review**: The skill's YAML frontmatter declares what tools/MCPs it needs. User must approve permissions before first activation.

### Config

```jsonc
{
  "provenance_guard": {
    "enabled": true,
    "trusted_sources": ["github.com/obra/superpowers", "github.com/prime-radiant-inc/*"],
    "min_repo_age_days": 30,
    "min_stars": 10,
    "require_permission_review": true
  }
}
```

---

## 12. Hooks (final)

53 base hooks in omo → ~44 after cuts + additions:

| Tier | Hooks | Notes |
|------|-------|-------|
| Session | ~20 | Removed CC hooks, openclaw, tmux |
| Tool Guard | ~16 | Removed CC-specific guards, **added confidential-file-guard** (replaces bash-file-read-guard) |
| Transform | 3 | keywordDetector, contextInjector, toolPairValidator (removed claudeCodeHooks) |
| Continuation | 6 | StopGuard, compactionContextInjector, compactionTodoPreserver, **auditLoop** (NEW), unstableAgentBabysitter, backgroundNotificationHook |
| Skill | 2 | categorySkillReminder, autoSlashCommand |

With team-mode enabled: +1 tool guard (teamToolGating), +2 transform (teamStatusInjector, teamMailboxInjector), +4 direct event handlers.

---

## 13. Feature Modules (final)

| Feature | LOC (est) | Status |
|---------|-----------|--------|
| team-mode | ~13k | KEPT (config-gated, OFF by default) |
| background-agent | ~2k | KEPT |
| opencode-skill-loader | ~2.8k | KEPT |
| builtin-skills | ~3k | KEPT |
| skill-mcp-manager | ~2k | KEPT |
| tool-metadata-store | ~115 | KEPT |
| confidential-file-guard | ~300 | NEW |
| context-injector | ~200 | KEPT |
| hook-message-injector | ~150 | KEPT |
| run-continuation-state | ~50 | KEPT |
| opencode-runtime-skills | ~300 | KEPT |
| task-toast-manager | ~300 | KEPT |
| session-state | ~1k | RENAMED from claude-code-session-state |
| skill-command-registrar | ~500 | NEW |
| audit-loop hook | ~300 | NEW |
| cost-tracker | ~400 | NEW |
| failure-journal | ~300 | NEW |

| ml-ai-skills (6 skill files) | ~1.2k | NEW |

**Total kept:** ~25k LOC from omo (+ ~3k LOC new)

### Cost Tracker

Logs token usage and estimated cost per agent per session. Exposed via `oh-my-agent doctor --cost` or `oh-my-agent cost`.

```
src/features/cost-tracker/
├── index.ts        # recordTokenUsage(), getSessionCost(), getAgentCost()
├── store.ts        # JSONL persistence (append-only)
└── types.ts
```

Tracks: sessionId, agentName, model, inputTokens, outputTokens, estimatedCost, timestamp.

**Model tiering** — Even with "inherit caller model by default," default sensible assignments prevent waste:

| Tier | Models | Default Agents |
|------|--------|---------------|
| **cheap** | claude-sonnet, gpt-5-mini, gemini-flash | Explore, Librarian, Sisyphus-Junior |
| **medium** | claude-sonnet-4, gpt-5 | Momus, Metis, Cold-Eyes |
| **expensive** | claude-opus-4, gpt-5-5 | Sisyphus, Hephaestus, the-auditor, ML/AI Engineering |

Agents in cheaper tiers inherit the caller model but if the caller is using opus, the agent downgrades to its tier's default rather than burning opus tokens on file search. Configurable via `agents.<name>.model_tier`.

### Failure Journal

Persistent memory across sessions. When the-auditor or Cold-Eyes finds a bug, they log it:

```
src/features/failure-journal/
├── index.ts     # recordFailure(), getKnownIssuesForFile()
├── store.ts     # JSONL persistence (~/.config/oh-my-agent/failure-journal.jsonl)
└── types.ts
```

Record format:
```typescript
interface FailureRecord {
  id: string;
  timestamp: string;
  sessionId: string;
  filePath: string;
  rootCause: string;        // short natural language summary
  pattern: string;           // category: "race-condition", "off-by-one", "stale-cache"
  fixDescription: string;
  reportedBy: "the-auditor" | "cold-eyes" | "user";
  resolved: boolean;
}
```

**Integration:**
- `getKnownIssuesForFile(filePath)` is called by the `contextInjector` transform hook. Before an agent edits a file, the journal is checked and known issues are injected into context: "This file has had N bugs related to X in the past."
- `recordFailure` is called at the end of each audit-loop cycle by both the-auditor and Cold-Eyes (with `reportedBy` distinguishing them) — providing data to evaluate if Cold-Eyes catches things the-auditor misses.
- CLI command: `oh-my-agent journal` (list/search/clear) so users can inspect and purge.

---

## 14. Implementation Phases

### Phase 1: Fork + Prune (Week 1)
- Fork oh-my-openagent at current commit
- Remove all CUT directories
- Rename claude-code-session-state → session-state
- Remove claude-code-hooks hook (transform tier 4→3)
- Verify it compiles and basic tests pass
- Rename package, bin names, config paths

### Phase 2: Dependency Inlining (Week 1-2)
- Inline kept packages/*-core/ into src/shared/ or features/
- Remove packages/ directory, package.json workspace config
- Single `tsconfig.json`, single `bun build` target
- Verify all imports resolve

### Phase 3: Model Inheritance (Week 2-3)
- Remove AGENT_MODEL_REQUIREMENTS and CATEGORY_MODEL_REQUIREMENTS
- Update model-fallback hook to use caller model inheritance
- Update delegate-task to pass caller model instead of category chain
- Update background-agent fallback logic
- ~44 files affected, comprehensive test updates

### Phase 4: Audit-Loop + Cold-Eyes (Week 3)
- Create the-auditor agent (mode: "all")
- Create Cold-Eyes agent (mode: "subagent")
- Remove todoContinuationEnforcer and boulder parts of atlasHook
- Create auditContinuationHook
- Add 2-verifier dispatch (the-auditor → Cold-Eyes)
- Add sanitized context builder for Verifier 2

### Phase 5: ML/AI Engineering Agent + Skill Pack (Week 3)
- Integrate HF ml-intern system prompts (v2, v3, base variants)
- Wire as mode: "all" agent
- Add to builtin-agents registry
- Create 6 ML/AI skills (Haruspex scaffolds via writing-skills): experiment-tracking, data-pipeline-hygiene, reproducible-training, hyperparameter-discipline, evaluation-integrity, model-surgery-safety

### Phase 6: Haruspex + Customize-oma (Week 3-4)
- Create Haruspex agent (mode: "subagent")
- Create customize-oma.skill.md (auto-generated by Haruspex)
- Wire Haruspex into agent registry
- Haruspex prompt includes full project structure knowledge

### Phase 7: Skill Commands + Manifest (Week 4)
- Create skill-command-registrar
- Read SKILL.md YAML frontmatter → auto-register /commands
- Create dynamic skill-manifest.json at startup
- Wire manifest into agent prompt injection (category-skill-reminder)

### Phase 8: Confidential File Guard + Secret Scanner (Week 4)
- Create `hooks/confidential-file-guard/` hook (read-side)
- Create `hooks/secret-scanner/` hook (write-side)
- Secret Scanner: known patterns + entropy detection + git commit guard
- Config schema for both
- Remove/replace `bash-file-read-guard.ts`
- Tests for all blocked vectors

### Phase 9: Provenance Guard (Week 4)
- Create provenance guard in skill-mcp-manager
- Source verification (trusted registries, repo age/stars heuristics)
- Permission review flow for new skills/MCPs
- Config schema for `provenance_guard`

### Phase 10: Cost Tracker + Failure Journal (Week 4)
- Create `features/cost-tracker/` with JSONL store
- Expose via `oh-my-agent cost` CLI command
- Create `features/failure-journal/` with JSONL store
- Wire `getKnownIssuesForFile` into contextInjector transform hook
- Wire `recordFailure` into audit-loop (both verifiers)
- Expose via `oh-my-agent journal` CLI command
- Model tiering defaults per agent

### Phase 11: Install Script + Config Export (Week 4)
- Create `install.sh` (Unix — Linux / macOS)
- Create `install.ps1` (Windows — PowerShell 5.1+)
- Both scripts handle path differences (`~/.config/` vs `$env:APPDATA\`)
- Create config export/import CLI
- Add superpowers cloning to install flow
- Test from scratch on Linux, macOS, and Windows (via CI matrix)

### Phase 12: Haruspex Self-Modification Guard (Week 5)
- Create `haruspex-guard` Tool Guard hook with path scope table
- Config schema for allowed modification paths
- Diff display logic for agent prompt/config changes

### Phase 13: Polish + Docs (Week 5)
- Clean up remaining omo references
- Verify all tests pass
- Write README
- First release

---

## 15. Renaming

The project name may change if "oh-my-agent" is too close to "oh-my-openagent/oh-my-openagent" (which was already renamed from "oh-my-opencode" during a transition period).

Candidates discussed:
- `oh-my-agent` (current placeholder)
- `oh-my-oma` (if the original omo connotation is fine)
- Something else TBD

Config paths, bin names, env vars, and npm package name all follow the final project name.

---

## 16. Risks

| Risk | Mitigation |
|------|-----------|
| model-requirements refactor: 44 files, 2-3 days, pervasive test changes | Phase 3 is isolated and reversible. Run full test suite before/after. |
| Inlined core packages may diverge from upstream omo | Acceptable — this is a fork, not a downstream. Changes are intentional. |
| Audit-loop adds latency (2 verifier calls) | Both verifiers run in parallel. Optional config flag to skip Verifier 2. |
| Haruspex may hallucinate harness structure | Haruspex prompt includes auto-generated manifest of actual project files. Manifest is checked into repo. |
| Skill discovery path for superpowers may need adjustment | Install script symlinks into a known path. Fallback: user config can set custom skill paths. |
| Confidential file guard may block legitimate reads (false positives) | Configurable paths list. Users can add/remove patterns. Matching uses strict glob — not heuristic. |
| Models may find workarounds not covered by initial regex patterns | Extensible design — new patterns added to the regex list without code changes. Config-driven. |
| Secret Scanner false positives on high-entropy test data or fixtures | Allowlist per file/pattern in config. Test fixtures in `**/fixtures/**` or `*.test.ts` are pre-allowlisted. |
| Audit-loop circuit breaker may interrupt legitimate long-running fixes (rare) | Configurable max iterations (default 3). User can override with `--force-continue` flag. |
| Cost tracker adds per-call overhead (token counting + I/O) | Async write with batching. JSONL append is sub-ms per record. No impact on tool execution latency. |
| Failure journal grows unbounded | CLI `journal clear` and optional max age retention (config: `failure_journal.max_age_days`). |
| Provenance guard blocks legitimate new skills from unknown but trustworthy sources | Configurable `trusted_sources` list. User can add GitHub orgs or specific repos. |
