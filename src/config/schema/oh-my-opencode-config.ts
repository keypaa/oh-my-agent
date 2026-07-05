import { z } from "zod"
import { AnyMcpNameSchema } from "../../mcp/types"
import { AgentDefinitionsConfigSchema } from "./agent-definitions"
import { AgentOverridesSchema } from "./agent-overrides"
import { BabysittingConfigSchema } from "./babysitting"
import { BackgroundTaskConfigSchema } from "./background-task"
import { BrowserAutomationConfigSchema } from "./browser-automation"
import { CategoriesConfigSchema } from "./categories"

import { CodegraphConfigSchema } from "./codegraph"
import { CommentCheckerConfigSchema } from "./comment-checker"
import { BuiltinCommandNameSchema } from "./commands"
import { DefaultModeConfigSchema } from "./default-mode"
import { ExperimentalConfigSchema } from "./experimental"
import { GitMasterConfigSchema } from "./git-master"
import { I18nConfigSchema } from "./i18n"
import { KeywordDetectorConfigSchema } from "./keyword-detector"
import { NotificationConfigSchema } from "./notification"

import { ModelCapabilitiesConfigSchema } from "./model-capabilities"

import { RalphLoopConfigSchema } from "./ralph-loop"
import { RuntimeFallbackConfigSchema } from "./runtime-fallback"
import { TeamModeConfigSchema } from "./team-mode"
import { SkillsConfigSchema } from "./skills"
import { SisyphusConfigSchema } from "./sisyphus"
import { SisyphusAgentConfigSchema } from "./sisyphus-agent"

import { StartWorkConfigSchema } from "./start-work"
import { WebsearchConfigSchema } from "./websearch"
import { ClaudeCodeConfigSchema } from "./claude-code"
import { TmuxConfigSchema } from "./tmux"
import { AuditLoopConfigSchema } from "./audit-loop"
import { CostTrackerConfigSchema } from "./cost-tracker"
import { FailureJournalConfigSchema } from "./failure-journal"
import { ModelTierConfigSchema } from "./model-tier"
import { ConfidentialFilesConfigSchema, SecretScannerConfigSchema } from "../../features/security-guards/config-schema"
import { ProvenanceGuardConfigSchema } from "../../features/provenance-guard/config-schema"
import { HaruspexGuardConfigSchema } from "./haruspex-guard"

export const OhMyOpenCodeConfigSchema = z.object({
  $schema: z.string().optional(),
  /** Enable new task system (default: false) */
  new_task_system_enabled: z.boolean().optional(),
  /** Default agent name for `oh-my-agent run` (env: OPENCODE_DEFAULT_AGENT) */
  default_run_agent: z.string().optional(),
  /** Preferred display order for known agents. Invalid names are ignored with a toast warning. */
  agent_order: z.array(z.string().max(128)).max(64).optional(),
  /** Paths to external agent definition files (.md or .json) */
  agent_definitions: AgentDefinitionsConfigSchema,
  disabled_mcps: z.array(AnyMcpNameSchema).optional(),
  disabled_agents: z.array(z.string()).optional(),
  disabled_skills: z.array(z.string()).optional(),
  // NOTE: intentionally z.string() (not a known-value enum) — unknown values are silently
  // ignored to allow forward-compat with future hooks/tools without breaking older configs.
  disabled_hooks: z.array(z.string()).optional(),
  disabled_commands: z.array(BuiltinCommandNameSchema).optional(),
  /** Disable specific tools by name (e.g., ["todowrite", "todoread"]) */
  // NOTE: intentionally z.string() (not a known-value enum) — unknown values are silently
  // ignored to allow forward-compat with future hooks/tools without breaking older configs.
  disabled_tools: z.array(z.string()).optional(),
  /**
   * Provider prefixes to exclude from every agent/category fallback chain at
   * load time. Each entry matches the first slash-separated segment of a model
   * id (e.g., "github-copilot" matches "github-copilot/gpt-5.5"). If a primary
   * `model` references a disabled provider, it is replaced with the first
   * allowed entry from the same chain.
   */
  disabled_providers: z.array(z.string()).optional(),
  mcp_env_allowlist: z.array(z.string()).optional(),
  /** Enable hashline_edit tool/hook integrations (default: false) */
  hashline_edit: z.boolean().optional(),
  /** Enable anonymous telemetry. Default: enabled when omitted. Set to false to disable. Independent of codegraph.telemetry. */
  telemetry: z.boolean().optional().describe("Enable or disable anonymous telemetry. Default: enabled when omitted. Set to false to disable. Independent of codegraph.telemetry."),
  /** Enable model fallback on API errors (default: false). Set to true to enable automatic model switching when model errors occur. */
  model_fallback: z.boolean().optional(),
  agents: AgentOverridesSchema.optional(),
  categories: CategoriesConfigSchema.optional(),

  sisyphus_agent: SisyphusAgentConfigSchema.optional(),
  comment_checker: CommentCheckerConfigSchema.optional(),
  experimental: ExperimentalConfigSchema.optional(),
  auto_update: z.boolean().optional(),
  skills: SkillsConfigSchema.optional(),
  ralph_loop: RalphLoopConfigSchema.optional(),
  /**
   * Enable runtime fallback (default: false)
   * Set to false to disable, or use object for advanced config:
   * { "enabled": true, "retry_on_errors": [429, 500, 502, 503, 504], "timeout_seconds": 30 }
   */
  runtime_fallback: z.union([z.boolean(), RuntimeFallbackConfigSchema]).optional(),
  background_task: BackgroundTaskConfigSchema.optional(),
  notification: NotificationConfigSchema.optional(),
  model_capabilities: ModelCapabilitiesConfigSchema.optional(),

  /** Plugin i18n settings */
  i18n: I18nConfigSchema.optional(),

  codegraph: CodegraphConfigSchema.optional(),
  team_mode: TeamModeConfigSchema.optional(),
  keyword_detector: KeywordDetectorConfigSchema.optional(),
  babysitting: BabysittingConfigSchema.optional(),
  git_master: GitMasterConfigSchema.default({
    commit_footer: true,
    include_co_authored_by: true,
    git_env_prefix: "GIT_MASTER=1",
  }),
  browser_automation_engine: BrowserAutomationConfigSchema.optional(),
  websearch: WebsearchConfigSchema.optional(),

  sisyphus: SisyphusConfigSchema.optional(),
  start_work: StartWorkConfigSchema.optional(),
  /** Default mode auto-activation settings (ultrawork, ralph loop) */
  default_mode: DefaultModeConfigSchema.optional(),
  claude_code: ClaudeCodeConfigSchema.optional(),
  tmux: TmuxConfigSchema.optional(),
  /** Audit loop: dual-verifier completion check (the-auditor + Cold-Eyes) */
  audit_loop: AuditLoopConfigSchema.optional(),
  /** Confidential file guard: blocks reading secrets from files */
  confidential_files: ConfidentialFilesConfigSchema.optional(),
  /** Secret scanner: blocks writing secrets into files */
  secret_scanner: SecretScannerConfigSchema.optional(),
  /** Provenance guard: validates external skills and MCP servers before installation */
  provenance_guard: ProvenanceGuardConfigSchema.optional(),
  /** Haruspex guard: restricts Haruspex agent to its maintenance scope */
  haruspex_guard: HaruspexGuardConfigSchema.default({
    enabled: true,
    allowed_paths: [
      "src/agents/**",
      "src/hooks/**",
      "src/features/builtin-skills/**",
      "src/config/schema/**",
      "src/cli/**",
      "packages/shared-skills/**",
      "docs/**",
      "*.md",
    ],
    denied_paths: [
      "src/plugin/**",
      "src/shared/**",
      "src/mcp/**",
      "package.json",
      "bun.lock",
      ".git/**",
    ],
    require_confirmation: [
      "src/agents/builtin-agents.ts",
      "src/config/schema/oh-my-opencode-config.ts",
      "src/plugin-handlers/**",
    ],
    show_diff: true,
  }),
  /** Cost tracker: JSONL store for token usage and cost per agent per session */
  cost_tracker: CostTrackerConfigSchema.default({ enabled: true, max_file_size_mb: 10 }),
  /** Failure journal: persistent memory of bugs found by auditors across sessions */
  failure_journal: FailureJournalConfigSchema.default({ enabled: true, max_age_days: 90 }),
  /** Model tiering: which agents use cheap/medium/expensive models */
  model_tier: ModelTierConfigSchema.default({
    cheap: ["explore", "librarian", "sisyphus-junior"],
    medium: ["momus", "metis", "cold-eyes"],
          expensive: ["sisyphus", "hephaestus", "the-auditor", "ml-ai-engineer"],
  }),
  /** Migration history to prevent re-applying migrations (e.g., model version upgrades) */
  _migrations: z.array(z.string()).optional(),
})

export type OhMyOpenCodeConfig = z.infer<typeof OhMyOpenCodeConfigSchema>
