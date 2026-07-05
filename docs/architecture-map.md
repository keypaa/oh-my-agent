# oh-my-agent Architecture Map

> Complete visual reference of the plugin internals. Each mermaid diagram is a self-contained subsystem.

## Table of Contents

1. [Plugin Entry & Initialization](#1-plugin-entry--initialization)
2. [Agent System (15 agents)](#2-agent-system-15-agents)
3. [Hook System (5-tier, 53-63 hooks)](#3-hook-system-5-tier-53-63-hooks)
4. [Hook Event Routing](#4-hook-event-routing)
5. [Tool Catalog (31 native + 6 LSP)](#5-tool-catalog-31-native--6-lsp)
6. [Feature Modules (19)](#6-feature-modules-19)
7. [Background-Agent Lifecycle](#7-background-agent-lifecycle)
8. [Audit-Loop](#8-audit-loop)
9. [Config System](#9-config-system)
10. [MCP System (3 tiers)](#10-mcp-system-3-tiers)
11. [Model Resolution](#11-model-resolution)
12. [File Reference Tables](#12-file-reference-tables)

---

## 1. Plugin Entry & Initialization

```mermaid
flowchart TD
    A["src/index.ts:6 default export"] --> B["src/testing/create-plugin-module.ts:97"]
    B --> C["installAgentSortShim shared/agent-sort-shim"]
    C --> D["initConfigContext cli/config-manager"]
    D --> E["migrateLegacyWorkspaceDirectory shared/"]
    E --> F["detectDuplicateOmoPlugin shared/"]
    F --> G["injectServerAuthIntoClient shared/"]
    G --> H["loadPluginConfig plugin-config/layered-config-loader.ts:121"]
    H --> I["recordPluginTelemetry shared/posthog"]
    I --> J["initLiveServerRoute shared/live-server-route"]
    J --> K["selectRuntimeSecuritySkills features/opencode-runtime-skills"]
    K --> L["initI18n shared/i18n"]
    L --> M["setAgentSortOrder shared/agent-sort-shim"]
    M --> N["checkTeamModeDependencies features/team-mode/deps"]
    N --> O["createModelCacheState plugin-state.ts"]
    O --> P["createManagers create-managers.ts:42"]
    P --> Q["createTools create-tools.ts:23"]
    Q --> R["createHooks create-hooks.ts:33"]
    R --> S["createPluginInterface plugin-interface.ts:20"]
    S --> T["createPluginDispose plugin-dispose.ts:5"]
    T --> U["+session.compacting +compaction.autocontinue"]
    U --> V["Return pluginHooks to OpenCode"]
```

**Key files:**
- Entry: `src/index.ts:6` — thin wrapper, calls `createPluginModule()`
- Orchestrator: `src/testing/create-plugin-module.ts:97` — all 25 init steps
- Interface: `src/plugin-interface.ts:20` — maps 14 OpenCode hook names to handlers

---

## 2. Agent System (15 agents)

```mermaid
flowchart LR
    subgraph PRIMARY["Primary (4) - user-facing"]
        SIS["Sisyphus - Ultraworker\nsrc/agents/sisyphus-agent-factory.ts:67\nmode: primary"]
        HEP["Hephaestus - Deep Agent\nsrc/agents/hephaestus/agent.ts:131\nmode: primary"]
        PRO["Prometheus - Plan Builder\nsrc/agents/prometheus/system-prompt.ts\nmode: primary"]
        ATL["Atlas - Plan Executor\nsrc/agents/atlas/agent.ts:119\nmode: primary"]
    end

    subgraph SUBS["Subagent (9) - delegated"]
        ORA["Oracle\nsrc/agents/oracle.ts:411\nread-only"]
        LIB["Librarian\nsrc/agents/librarian.ts:24\nread-only"]
        EXP["Explore\nsrc/agents/explore.ts:27\nread-only"]
        MM["Multimodal-Looker\nsrc/agents/multimodal-looker.ts:14\nread+only"]
        MET["Metis - Plan Consultant\nsrc/agents/metis.ts:398\nread-only"]
        MOM["Momus - Plan Critic\nsrc/agents/momus.ts:281\nread-only"]
        SJ["Sisyphus-Junior\nsrc/agents/sisyphus-junior/agent.ts:100\ncategory executor"]
        CE["Cold Eyes\nsrc/agents/cold-eyes.ts:89\nverifier 2"]
        HAR["Haruspex\nsrc/agents/haruspex.ts:102\nmaintenance"]
    end

    subgraph ALLMODE["All Mode (2)"]
        AUD["The Auditor\nsrc/agents/the-auditor.ts:88\nverifier 1"]
        ML["ML/AI Engineer\nsrc/agents/ml-ai-engineer.ts:81\nML specialist"]
    end
```

**Agent modes:**
- `primary` = user can select directly (4)
- `subagent` = only spawned via `task` tool (9)
- `all` = both primary and subagent (2)

**Model inheritance:** All agents inherit caller's model by default. No hardcoded model requirements in code. Config override via `agents.<name>.model`.

**Tool restrictions:**
| Agent | Denied Tools |
|-------|-------------|
| Oracle | write, edit, apply_patch, task |
| Librarian | write, edit, apply_patch, task, call_omo_agent |
| Explore | write, edit, apply_patch, task, call_omo_agent |
| Multimodal-Looker | ALL except read (allowlist) |
| Metis | write, edit, apply_patch |
| Momus | write, edit, apply_patch |
| The Auditor | write, edit, apply_patch, task |
| Cold Eyes | write, edit, apply_patch, task |
| Haruspex | write, edit, apply_patch |
| Sisyphus-Junior | task (+ apply_patch blocked for GPT) |
| Sisyphus | None |
| Hephaestus | call_omo_agent |
| Atlas | task, call_omo_agent |
| Prometheus | .md-only writes (hook-enforced) |
| ML/AI Engineer | None |

---

## 3. Hook System (5-tier, 53-63 hooks)

```mermaid
flowchart TD
    CH["createHooks\nsrc/create-hooks.ts:33"] --> CC["createCoreHooks\nsrc/plugin/hooks/create-core-hooks.ts:11"]
    CH --> CONT["createContinuationHooks\nsrc/plugin/hooks/create-continuation-hooks.ts:26"]
    CH --> SK["createSkillHooks\nsrc/plugin/hooks/create-skill-hooks.ts:14"]

    CC --> S1["Tier 1: Session (24)\nsrc/plugin/hooks/create-session-hooks.ts:69"]
    CC --> S2["Tier 2: Tool Guard (17-20)\nsrc/plugin/hooks/create-tool-guard-hooks.ts:58"]
    CC --> S3["Tier 3: Transform (3-5)\nsrc/plugin/hooks/create-transform-hooks.ts:25"]

    S1 --> SH["24 session hooks"]
    S2 --> TG["17-20 tool guard hooks"]
    S3 --> TF["3-5 transform hooks"]
    CONT --> CO["7 continuation hooks"]
    SK --> SKH["2 skill hooks"]
```

### Tier 1: Session Hooks (24)

| # | Hook Name | File:Line | Event |
|---|-----------|-----------|-------|
| 1 | preemptive-compaction | `hooks/preemptive-compaction.ts:14` | tool.execute.after + event |
| 2 | session-notification | `hooks/session-notification.ts:30` | event |
| 3 | think-mode | `hooks/think-mode/hook.ts:13` | chat.message + event |
| 4 | model-fallback | `plugin/hooks/create-session-hooks.ts:111` | chat.params |
| 5 | anthropic-context-window-limit-recovery | `hooks/anthropic-context-window-limit-recovery/recovery-hook.ts:37` | event |
| 6 | auto-update-checker | `hooks/auto-update-checker/hook.ts:53` | event (session.created) |
| 7 | codegraph-bootstrap | `hooks/codegraph-bootstrap/hook.ts:212` | event (session.created) |
| 8 | ast-grep-sg-provision | `hooks/ast-grep-sg-provision/hook.ts:55` | event (session.created) |
| 9 | agent-usage-reminder | `hooks/agent-usage-reminder/hook.ts:51` | tool.execute.after + event |
| 10 | non-interactive-env | `hooks/non-interactive-env/non-interactive-env-hook.ts:68` | tool.execute.before |
| 11 | interactive-bash-session | `hooks/interactive-bash-session/hook.ts:30` | tool.execute.after + event |
| 12 | ralph-loop | `hooks/ralph-loop/ralph-loop-hook.ts:46` | event (session.idle) |
| 13 | edit-error-recovery | `hooks/edit-error-recovery/hook.ts:39` | tool.execute.after |
| 14 | delegate-task-retry | `hooks/delegate-task-retry/hook.ts:6` | tool.execute.after |
| 15 | start-work | `hooks/start-work/start-work-hook.ts:57` | chat.message + command.execute.before |
| 16 | prometheus-md-only | `hooks/prometheus-md-only/hook.ts:12` | tool.execute.before |
| 17 | sisyphus-junior-notepad | `hooks/sisyphus-junior-notepad/hook.ts:9` | tool.execute.before |
| 18 | question-label-truncator | `hooks/question-label-truncator/hook.ts:50` | tool.execute.before |
| 19 | task-resume-info | `hooks/task-resume-info/hook.ts:5` | tool.execute.after |
| 20 | no-sisyphus-gpt | `hooks/no-sisyphus-gpt/hook.ts:45` | chat.message |
| 21 | no-hephaestus-non-gpt | `hooks/no-hephaestus-non-gpt/hook.ts:37` | chat.message |
| 22 | hephaestus-agents-md-injector | `hooks/hephaestus-agents-md-injector/hook.ts:53` | chat.message + event |
| 23 | runtime-fallback | `hooks/runtime-fallback/hook.ts:29` | event + chat.message |
| 24 | legacy-plugin-toast | `hooks/legacy-plugin-toast/hook.ts:14` | event (session.created) |

### Tier 2: Tool Guard Hooks (17-20)

| # | Hook Name | File:Line | Event |
|---|-----------|-----------|-------|
| 1 | comment-checker | `hooks/comment-checker/hook.ts:36` | tool.execute.before + after + event |
| 2 | tool-output-truncator | `hooks/tool-output-truncator.ts:36` | tool.execute.after |
| 3 | directory-agents-injector | `hooks/directory-agents-injector/hook.ts:38` | tool.execute.after + event |
| 4 | directory-readme-injector | `hooks/directory-readme-injector/hook.ts:33` | tool.execute.after + event |
| 5 | empty-task-response-detector | `hooks/empty-task-response-detector.ts:12` | tool.execute.after |
| 6 | rules-injector | `hooks/rules-injector/hook.ts:38` | tool.execute.before + after + event |
| 7 | tasks-todowrite-disabler | `hooks/tasks-todowrite-disabler/hook.ts:10` | tool.execute.before |
| 8 | write-existing-file-guard | `hooks/write-existing-file-guard/hook.ts:80` | tool.execute.before + event |
| 9 | hashline-read-enhancer | `hooks/hashline-read-enhancer/hook.ts:192` | tool.execute.after |
| 10 | json-error-recovery | `hooks/json-error-recovery/hook.ts:52` | tool.execute.after |
| 11 | read-image-resizer | `hooks/read-image-resizer/hook.ts:115` | tool.execute.after |
| 12 | todo-description-override | `hooks/todo-description-override/hook.ts:3` | tool.definition |
| 13 | webfetch-redirect-guard | `hooks/webfetch-redirect-guard/` | tool.execute.before |
| 14 | fsync-skip-warning | `hooks/fsync-skip-warning/index.ts:20` | tool.execute.before + after |
| 15 | notepad-write-guard | `hooks/notepad-write-guard/index.ts:27` | tool.execute.before |
| 16 | plan-format-validator | `hooks/plan-format-validator/hook.ts:96` | tool.execute.after |
| 17 | confidential-file-guard | `hooks/confidential-file-guard/index.ts:31` | tool.execute.before + after |
| 18 | secret-scanner | `hooks/secret-scanner/index.ts:40` | tool.execute.before |
| 19 | haruspex-guard | `hooks/haruspex-guard/index.ts:21` | tool.execute.before |
| +1 | team-tool-gating | `hooks/team-tool-gating/hook.ts:81` | tool.execute.before (team-mode only) |

### Tier 3: Transform Hooks (3-5)

| # | Hook Name | File:Line | Event |
|---|-----------|-----------|-------|
| 1 | keyword-detector | `hooks/keyword-detector/hook.ts:39` | chat.message |
| 2 | context-injector-messages-transform | `features/context-injector/index.ts` | messages.transform |
| 3 | tool-pair-validator | `hooks/tool-pair-validator/hook.ts:4` | messages.transform |
| +1 | team-mode-status-injector | `hooks/team-mode-status-injector/hook.ts:119` | messages.transform (team only) |
| +2 | team-mailbox-injector | `hooks/team-mailbox-injector/hook.ts:90` | messages.transform (team only) |

### Tier 4: Continuation Hooks (7)

| # | Hook Name | File:Line | Event |
|---|-----------|-----------|-------|
| 1 | stop-continuation-guard | `hooks/stop-continuation-guard/hook.ts:26` | chat.message + event |
| 2 | compaction-context-injector | `hooks/compaction-context-injector/hook.ts:15` | event (session.compacted) |
| 3 | compaction-todo-preserver | `hooks/compaction-todo-preserver/hook.ts:112` | event + tool.execute.before |
| 4 | unstable-agent-babysitter | `hooks/unstable-agent-babysitter/unstable-agent-babysitter-hook.ts:148` | event |
| 5 | background-notification | `hooks/background-notification/hook.ts:38` | chat.message + event |
| 6 | atlas | `hooks/atlas/atlas-hook.ts:7` | event (session.idle) + tool.execute |
| 7 | audit-loop | `hooks/audit-loop/audit-loop-hook.ts:199` | event (session.idle) |

### Tier 5: Skill Hooks (2)

| # | Hook Name | File:Line | Event |
|---|-----------|-----------|-------|
| 1 | category-skill-reminder | `hooks/category-skill-reminder/hook.ts:59` | tool.execute.after + event |
| 2 | auto-slash-command | `hooks/auto-slash-command/hook.ts:75` | chat.message + command.execute.before |

### Team-Mode Event Handlers (+4)

| # | Handler | File:Line |
|---|---------|-----------|
| 1 | team-idle-wake-hint | `hooks/team-session-events/team-idle-wake-hint.ts` |
| 2 | team-lead-orphan-handler | `hooks/team-session-events/team-lead-orphan-handler.ts` |
| 3 | team-member-error-handler | `hooks/team-session-events/team-member-error-handler.ts` |
| 4 | team-member-status-handler | `hooks/team-session-events/team-member-status-handler.ts` |

---

## 4. Hook Event Routing

```mermaid
flowchart LR
    EV["OpenCode Event"] --> CM["chat.message"]
    EV --> CP["chat.params"]
    EV --> TD["tool.definition"]
    EV --> TB["tool.execute.before"]
    EV --> TA["tool.execute.after"]
    EV --> CE["command.execute.before"]
    EV --> MT["messages.transform"]
    EV --> EV2["event"]
    EV --> SC["session.compacting"]
    EV --> CA["compaction.autocontinue"]

    CM --> CM_H["think-mode, keyword-detector, start-work\nno-sisyphus-gpt, no-hephaestus-non-gpt\nhephaestus-agents-md-injector\nstop-continuation-guard, task-resume-info\nsisyphus-junior-notepad, category-skill-reminder\nauto-slash-command, background-notification\nruntime-fallback, legacy-plugin-toast"]

    CP --> CP_H["model-fallback"]

    TB --> TB_H["rules-injector, write-existing-file-guard\nnotepad-write-guard, confidential-file-guard\nsecret-scanner, haruspex-guard, team-tool-gating\nprometheus-md-only, sisyphus-junior-notepad\nfsync-skip-warning, plan-format-validator\ncompaction-todo-preserver"]

    TA --> TA_H["comment-checker, tool-output-truncator\ndirectory-agents-injector, directory-readme-injector\nhashline-read-enhancer, json-error-recovery\nread-image-resizer, edit-error-recovery\ndelegate-task-retry, agent-usage-reminder\ncategory-skill-reminder, atlas, plan-format-validator\nconfidential-file-guard"]

    CE --> CE_H["start-work, auto-slash-command"]

    MT --> MT_H["context-injector, tool-pair-validator\nteam-mode-status-injector, team-mailbox-injector"]

    EV2 --> EV_H["session.created: auto-update-checker, codegraph-bootstrap\nsession.idle: ralph-loop, atlas, audit-loop, unstable-agent-babysitter\nsession.error: anthropic-context-window-limit-recovery\nsession.deleted: write-existing-file-guard, rules-injector\nmessage.updated: runtime-fallback, preemptive-compaction"]
```

---

## 5. Tool Catalog (31 native + 6 LSP)

```mermaid
flowchart TD
    TR["createToolRegistry\nsrc/plugin/tool-registry.ts:28"] --> CT["createCoreTools\nsrc/plugin/tool-registry-core-tools.ts:16"]
    TR --> TM["createTeamModeToolsRecord\nteam_mode.enabled gate"]
    TR --> TS["createTaskToolsRecord\nexperimental.task_system gate"]
    TR --> HL["createHashlineToolsRecord\nhashline_edit gate"]
    TR --> IB["interactive_bash\ntmux on PATH gate"]
    TR --> LA["look_at\nmultimodal-looker not disabled gate"]
    TR --> FL["filterDisabledTools + trimToolsToCap"]

    CT --> CORE["12 always-on:\ngrep, glob, session_list/read/search/info\nbackground_output, background_cancel\ncall_omo_agent, task, skill, skill_mcp"]

    TM --> TEAM["12 team tools:\nteam_create/delete/shutdown_request\napprove/reject_shutdown, send_message\nteam_task_create/list/update/get\nteam_status, team_list"]

    TS --> TASKS["4 task tools:\ntask_create, task_get\ntask_list, task_update"]

    HL --> HASHLINE["edit (hashline)\nsrc/tools/hashline-edit/tools.ts:14"]
```

**Always-on tools (12):**
| Tool | File:Line |
|------|-----------|
| grep | `src/tools/grep/tools.ts:8` |
| glob | `src/tools/glob/tools.ts:8` |
| session_list | `src/tools/session-manager/tools.ts:73` |
| session_read | `src/tools/session-manager/tools.ts:102` |
| session_search | `src/tools/session-manager/tools.ts:138` |
| session_info | `src/tools/session-manager/tools.ts:179` |
| background_output | `src/tools/background-task/create-background-output.ts` |
| background_cancel | `src/tools/background-task/create-background-cancel.ts` |
| call_omo_agent | `src/tools/call-omo-agent/tools.ts:111` |
| task | `src/tools/delegate-task/tools.ts:81` |
| skill | `src/tools/skill/tools.ts:28` |
| skill_mcp | `src/tools/skill-mcp/tools.ts:104` |

**LSP tools (via built-in MCP, not native):** lsp_goto_definition, lsp_find_references, lsp_symbols, lsp_diagnostics, lsp_prepare_rename, lsp_rename

---

## 6. Feature Modules (19)

```mermaid
flowchart LR
    subgraph CORE["Core Features"]
        BG["background-agent\nfeatures/background-agent/\n3149 LOC"]
        TM["team-mode\nfeatures/team-mode/\n~13k LOC"]
        SKM["skill-mcp-manager\nfeatures/skill-mcp-manager/"]
        SS["session-state\nfeatures/session-state/"]
    end

    subgraph SKILLS["Skill System"]
        BSK["builtin-skills\nfeatures/builtin-skills/\n16 skills"]
        BSC["builtin-commands\nfeatures/builtin-commands/"]
        SCR["skill-command-registrar\nfeatures/skill-command-registrar/"]
        OSL["opencode-skill-loader\nfeatures/opencode-skill-loader/"]
        ORS["opencode-runtime-skills\nfeatures/opencode-runtime-skills/"]
    end

    subgraph SECURITY["Security"]
        PG["provenance-guard\nfeatures/provenance-guard/"]
        SG["security-guards\nfeatures/security-guards/"]
        HGI["haruspex-guard\nsrc/hooks/haruspex-guard/"]
    end

    subgraph DATA["Data & State"]
        CT["cost-tracker\nfeatures/cost-tracker/"]
        FJ["failure-journal\nfeatures/failure-journal/"]
        TMS["tool-metadata-store\nfeatures/tool-metadata-store/"]
        RCS["run-continuation-state\nfeatures/run-continuation-state/"]
    end

    subgraph INJECTION["Context Injection"]
        CI["context-injector\nfeatures/context-injector/"]
        HMI["hook-message-injector\nfeatures/hook-message-injector/"]
    end

    subgraph COMPAT["Compatibility"]
        OPL["opencode-plugin-loader\nfeatures/opencode-plugin-loader/"]
        CCS["claude-code-stubs.ts"]
    end
```

| Feature | File | Purpose |
|---------|------|---------|
| background-agent | `src/features/background-agent/` | Task lifecycle, concurrency, polling |
| team-mode | `src/features/team-mode/` | Parallel multi-agent coordination |
| skill-mcp-manager | `src/features/skill-mcp-manager/` | Tier-3 MCP per-session isolation |
| builtin-skills | `src/features/builtin-skills/` | 16 skills (git-master, playwright, review-work, etc.) |
| builtin-commands | `src/features/builtin-commands/` | Command templates (refactor, init-deep, handoff) |
| context-injector | `src/features/context-injector/` | AGENTS.md/README.md injection |
| cost-tracker | `src/features/cost-tracker/` | Token usage + cost per session/agent |
| failure-journal | `src/features/failure-journal/` | Persistent bug memory for audit loop |
| provenance-guard | `src/features/provenance-guard/` | Source/content/permission verification |
| session-state | `src/features/session-state/` | Subagent session tracking |
| tool-metadata-store | `src/features/tool-metadata-store/` | Tool execution metadata cache |
| skill-command-registrar | `src/features/skill-command-registrar/` | Skill + /command registration |
| run-continuation-state | `src/features/run-continuation-state/` | oh-my-agent run persistence |
| opencode-skill-loader | `src/features/opencode-skill-loader/` | 4-scope skill discovery |
| opencode-runtime-skills | `src/features/opencode-runtime-skills/` | Runtime security skill source |
| hook-message-injector | `src/features/hook-message-injector/` | System message injection helper |
| security-guards | `src/features/security-guards/` | Confidential files + secret scanner |
| opencode-plugin-loader | `src/features/opencode-plugin-loader/` | Plugin component loading |
| claude-code-stubs | `src/features/claude-code-stubs.ts` | Claude Code compat stubs |

---

## 7. Background-Agent Lifecycle

```mermaid
flowchart LR
    L["1. LAUNCH\nmanager.ts:560\nlaunch LaunchInput"] --> Q["2. QUEUE\nmanager.ts:663\nprocessKey key"]
    Q --> R["3. RUN\nmanager.ts:739\nstartTask item"]
    R --> P["4. POLL\nmanager.ts:2899\npollRunningTasks 3s"]
    P --> E["5. EVENT\nmanager.ts:1617\nhandleEvent event"]
    E --> C["6. COMPLETE\nmanager.ts:2522\ntryCompleteTask"]
    C --> N["7. NOTIFY\nmanager.ts:2610\nnotifyParentSession"]
```

### Detailed Flow

```mermaid
flowchart TD
    LAUNCH["launch LaunchInput"] --> VALIDATE["validate agent, reserve subagent spawn"]
    VALIDATE --> CREATE_TASK["create BackgroundTask status=pending"]
    CREATE_TASK --> START_ATTEMPT["startAttempt task model"]
    START_ATTEMPT --> ENQUEUE["enqueue to queuesByKey concurrency key"]
    ENQUEUE --> TOAST["TaskToastManager.addTask show queued toast"]
    TOAST --> PROCESS["processKey fire-and-forget"]

    PROCESS --> ACQUIRE["ConcurrencyManager.acquire blocks if at limit 5 default"]
    ACQUIRE --> CHECK_CANCEL["check cancellation"]
    CHECK_CANCEL --> START["startTask"]
    START --> SESSION["client.session.create create child session"]
    SESSION --> BIND["bindAttemptSession link attempt to session"]
    BIND --> TOOLS["setSessionTools configure tool permissions"]
    TOOLS --> PROMPT["promptWithRetryInDirectory fire-and-forget"]
    PROMPT --> POLL["startPolling 3s interval"]

    POLL --> STATUS["fetch session statuses"]
    STATUS --> PRUNE["pruneStaleTasksAndNotifications"]
    PRUNE --> STALE["checkAndInterruptStaleTasks"]
    STALE --> CHECK["for each running task:"]
    CHECK --> ACTIVE{"session active?"}
    ACTIVE -->|yes| SKIP["skip event-based progress"]
    ACTIVE -->|terminal| COMPLETE["tryCompleteTask"]
    ACTIVE -->|idle/gone| VALIDATE2["validateSessionHasOutput"]
    VALIDATE2 --> TODOS["checkSessionTodos"]
    TODOS --> COMPLETE

    COMPLETE --> RESERVE["reserveNotificationPreparation"]
    RESERVE --> FINALIZE["finalizeAttempt completed"]
    FINALIZE --> RECORD["record to TaskHistory"]
    RECORD --> RELEASE["ConcurrencyManager.release"]
    RELEASE --> ABORT["abortWithTimeout session"]
    ABORT --> NOTIFY["enqueueNotificationForParent"]
    NOTIFY --> TOAST2["TaskToastManager.showCompletionToast"]
```

**Key timeouts:**
| Constant | Value | Purpose |
|----------|-------|---------|
| POLLING_INTERVAL_MS | 3,000ms | Poll frequency |
| MIN_IDLE_TIME_MS | 5,000ms | Min runtime before idle completion |
| MIN_STABILITY_TIME_MS | 10,000ms | Message count must be stable for 10s |
| TASK_TTL_MS | 30 min | Max lifetime for any task |
| DEFAULT_STALE_TIMEOUT_MS | 45 min | Stale task interruption |
| DEFAULT_MESSAGE_STALENESS_TIMEOUT_MS | 60 min | No-activity-since-start |
| TASK_CLEANUP_DELAY_MS | 10 min | Delay before removing from memory |

**Completion detection:** Both signals must agree:
1. Session idle event (session.idle or session.status idle)
2. Stability detection (message count unchanged for 10s)

---

## 8. Audit-Loop

```mermaid
flowchart TD
    START["startAudit sessionID context\naudit-loop-hook.ts:386"] --> STATE["set state.active=true\ncycleCount=0"]
    STATE --> IDLE["wait for session.idle event"]
    IDLE --> MATCH{"eventSessionID matches?"}
    MATCH -->|no| IDLE
    MATCH -->|yes| DEDUP{"inFlightSessions.has?"}
    DEDUP -->|yes| IDLE
    DEDUP -->|no| MESSAGES["ctx.client.session.messages"]
    MESSAGES --> DETECT["detectCompletionClaim messages\naudit-loop-hook.ts:57"]
    DETECT -->|no claim| IDLE
    DETECT -->|claim found| INCR["state.cycleCount++"]
    INCR --> MODEL["extractModelFromSession\naudit-loop-hook.ts:120"]
    MODEL --> V1["spawnVerifierSession the-auditor\naudit-loop-hook.ts:246\ninherits parent model"]
    V1 --> READ1["readSessionMessages 60s timeout"]
    READ1 --> VERDICT1["parseVerifierVerdict theAuditorText\naudit-loop-hook.ts:72"]

    VERDICT1 --> SKIP2{"skip_verifier_2?"}
    SKIP2 -->|yes| BOTH
    SKIP2 -->|no| V2["spawnVerifierSession cold-eyes\naudit-loop-hook.ts:306\nsanitized context only"]
    V2 --> READ2["readSessionMessages 60s timeout"]
    READ2 --> VERDICT2["parseVerifierVerdict coldEyesText"]

    VERDICT2 --> BOTH["bothApproved = auditor.approved AND coldEyes.approved"]
    VERDICT1 --> BOTH

    BOTH -->|approved| DONE["state.active=false audit complete"]
    BOTH -->|rejected| RECORD["recordFailure for each issue"]
    RECORD --> FEEDBACK["dispatchInternalPrompt feedback\naudit-loop-hook.ts:361"]
    FEEDBACK --> IDLE
```

**Verifier context:**
- The-Auditor: full context (original task + agent claims + changed files + plan)
- Cold-Eyes: sanitized context (original task + changed files ONLY, no agent self-report)

---

## 9. Config System

```mermaid
flowchart TD
    USER["User config\n~/.config/opencode/oh-my-agent.jsonc"] --> MERGE["mergeConfigs\nplugin-config/config-merger.ts:4"]
    WALKED["Walked configs\n.opencode/oh-my-agent.jsonc\nnearest first"] --> MERGE
    MERGE --> PARSE["Zod safeParse\nOhMyOpenCodeConfigSchema\n42 top-level fields"]
    PARSE --> MIGRATE["migrateConfigFile\nidempotent via _migrations"]
    MIGRATE --> CONFIG["PluginConfig object"]
```

**Merge strategy:**
| Field Category | Strategy |
|----------------|----------|
| agents, categories, team_mode, claude_code | deepMerge (recursive) |
| disabled_* arrays | Set union (concatenate + dedup) |
| mcp_env_allowlist | User-only (security) |
| All other fields | Override replaces base |

**Config walk order:**
1. Start with defaults (Zod safeParse fills omitted fields)
2. Merge user config layers (nearest first)
3. Merge ancestor configs (farthest first, so nearest ancestor wins last)

**48 schema files in `src/config/schema/`:**
| Schema | File | Purpose |
|--------|------|---------|
| Root | `oh-my-opencode-config.ts:41` | 42 top-level fields |
| Agent names | `agent-names.ts:3` | 15 builtin agents |
| Model tier | `model-tier.ts:3` | cheap/medium/expensive |
| Audit loop | `audit-loop.ts:3` | enabled, max_cycles, skip_verifier_2 |
| Team mode | `team-mode.ts` | Re-exports from team-core |
| Categories | `categories.ts:4` | 8 built-in categories |
| Hooks | `hooks.ts:3` | 56 hook names enum |
| Experimental | `experimental.ts` | Feature flags |

---

## 10. MCP System (3 tiers)

```mermaid
flowchart TD
    subgraph T1["Tier 1: Built-in\nsrc/mcp/index.ts:36"]
        WS["websearch\nmcp.exa.ai or mcp.tavily.com"]
        C7["context7\nmcp.context7.com/mcp"]
        GA["grep_app\nmcp.grep.app"]
        LSP["lsp\nnode packages/lsp-daemon/dist/cli.js"]
        CG["codegraph\ncodegraph serve --mcp"]
    end

    subgraph T2["Tier 2: Claude Code\nfeatures/claude-code-mcp-loader/"]
        MCP2[".mcp.json per-project\n${VAR} env expansion\nallowlist via mcp_env_allowlist"]
    end

    subgraph T3["Tier 3: Skill-embedded\nfeatures/skill-mcp-manager/"]
        SKM2["SKILL.md YAML frontmatter\nper-session isolation\nstdio + HTTP transport\nOAuth 2.0 + PKCE"]
    end
```

**Tier 3 lifecycle:**
1. session.created -> No action (lazy)
2. First MCP tool call -> getOrCreateClient creates + caches
3. Ongoing use -> lastUsedAt updated
4. Idle >5min -> cleanup timer removes
5. session.deleted -> disconnectSession closes clients
6. Process exit -> disconnectAll via SIGINT/SIGTERM

**Client key:** `${sessionID}:${skillName}:${serverName}` (per-session isolation)

---

## 11. Model Resolution

```mermaid
flowchart TD
    INPUT["model input"] --> OVERRIDE{"UI-selected model?"}
    OVERRIDE -->|yes| USE_UI["use UI model"]
    OVERRIDE -->|no| CATEGORY{"category default?"}
    CATEGORY -->|yes| USE_CAT["use category model"]
    CATEGORY -->|no| CHAIN["AGENT_MODEL_REQUIREMENTS chain"]
    CHAIN --> RESOLVE["resolveModel pipeline"]
    RESOLVE --> FALLBACK["System default fallback"]
```

**Model tier config (src/config/schema/model-tier.ts:3):**
- `cheap`: explore, librarian, sisyphus-junior
- `medium`: momus, metis, cold-eyes
- `expensive`: sisyphus, hephaestus, the-auditor, ml-ai-engineer

**Two fallback systems:**
- `model-fallback` (proactive, chat.params, hardcoded chains)
- `runtime-fallback` (reactive, session.error, configurable per-category/agent)

---

## 12. File Reference Tables

### Entry & Init
| File | Line | Role |
|------|------|------|
| `src/index.ts` | 6 | Plugin entry, exports server |
| `src/testing/create-plugin-module.ts` | 97 | createPluginModule, staged init |
| `src/plugin-interface.ts` | 20 | 14 OpenCode hook handlers |
| `src/create-managers.ts` | 42 | Manager instantiation |
| `src/create-tools.ts` | 23 | Tool registry assembly |
| `src/create-hooks.ts` | 33 | 5-tier hook composition |

### Agents (15)
| Agent | File | Line | Mode |
|-------|------|------|------|
| Sisyphus | `src/agents/sisyphus-agent-factory.ts` | 67 | primary |
| Hephaestus | `src/agents/hephaestus/agent.ts` | 131 | primary |
| Prometheus | `src/agents/prometheus/system-prompt.ts` | -- | primary |
| Atlas | `src/agents/atlas/agent.ts` | 119 | primary |
| Oracle | `src/agents/oracle.ts` | 411 | subagent |
| Librarian | `src/agents/librarian.ts` | 24 | subagent |
| Explore | `src/agents/explore.ts` | 27 | subagent |
| Multimodal-Looker | `src/agents/multimodal-looker.ts` | 14 | subagent |
| Metis | `src/agents/metis.ts` | 398 | subagent |
| Momus | `src/agents/momus.ts` | 281 | subagent |
| Sisyphus-Junior | `src/agents/sisyphus-junior/agent.ts` | 100 | subagent |
| The Auditor | `src/agents/the-auditor.ts` | 88 | all |
| Cold Eyes | `src/agents/cold-eyes.ts` | 89 | subagent |
| ML/AI Engineer | `src/agents/ml-ai-engineer.ts` | 81 | all |
| Haruspex | `src/agents/haruspex.ts` | 102 | subagent |

### Hook Tiers
| Tier | Count | Composer File |
|------|-------|---------------|
| Session | 24 | `src/plugin/hooks/create-session-hooks.ts:69` |
| Tool Guard | 17-20 | `src/plugin/hooks/create-tool-guard-hooks.ts:58` |
| Transform | 3-5 | `src/plugin/hooks/create-transform-hooks.ts:25` |
| Continuation | 7 | `src/plugin/hooks/create-continuation-hooks.ts:26` |
| Skill | 2 | `src/plugin/hooks/create-skill-hooks.ts:14` |
| Team Events | +4 | `src/plugin/event.ts` |

### Features
| Feature | Directory |
|---------|-----------|
| background-agent | `src/features/background-agent/` |
| team-mode | `src/features/team-mode/` |
| skill-mcp-manager | `src/features/skill-mcp-manager/` |
| builtin-skills | `src/features/builtin-skills/` |
| builtin-commands | `src/features/builtin-commands/` |
| context-injector | `src/features/context-injector/` |
| cost-tracker | `src/features/cost-tracker/` |
| failure-journal | `src/features/failure-journal/` |
| provenance-guard | `src/features/provenance-guard/` |
| session-state | `src/features/session-state/` |
| tool-metadata-store | `src/features/tool-metadata-store/` |
| skill-command-registrar | `src/features/skill-command-registrar/` |
| run-continuation-state | `src/features/run-continuation-state/` |
| opencode-skill-loader | `src/features/opencode-skill-loader/` |
| opencode-runtime-skills | `src/features/opencode-runtime-skills/` |
| hook-message-injector | `src/features/hook-message-injector/` |
| security-guards | `src/features/security-guards/` |
| opencode-plugin-loader | `src/features/opencode-plugin-loader/` |
| claude-code-stubs | `src/features/claude-code-stubs.ts` |

### Shared Utilities (most imported)
| Utility | File | Import Count |
|---------|------|-------------|
| logger | `src/shared/logger.ts` | 62 |
| data-path | `src/shared/data-path.ts` | 11 |
| model-requirements | `src/shared/model-requirements.ts` | 11 |
| system-directive | `src/shared/system-directive.ts` | 11 |
| frontmatter | `src/shared/frontmatter.ts` | 10 |

### Config Schema Files
| Schema | File |
|--------|------|
| Root | `src/config/schema/oh-my-opencode-config.ts:41` |
| Agent names | `src/config/schema/agent-names.ts:3` |
| Model tier | `src/config/schema/model-tier.ts:3` |
| Audit loop | `src/config/schema/audit-loop.ts:3` |
| Categories | `src/config/schema/categories.ts:4` |
| Hooks | `src/config/schema/hooks.ts:3` |
| Experimental | `src/config/schema/experimental.ts` |
| Background task | `src/config/schema/background-task.ts` |
| Team mode | `src/config/schema/team-mode.ts` |
| Skills | `src/config/schema/skills.ts` |
