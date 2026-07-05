import { Command, Option } from "commander"
import { install } from "./install"
import { run } from "./run"
import { doctor, resolveDoctorTarget } from "./doctor"
import { configureRuntimeCommands } from "./runtime-commands"
import { costCommand } from "./commands/cost"
import { journalCommand } from "./commands/journal"
import { configExportCommand, configImportCommand } from "./commands/config"
import type { InstallArgs } from "./types"
import type { RunOptions } from "./run"
import type { DoctorOptions } from "./doctor"
import packageJson from "../../package.json" with { type: "json" }

const VERSION = packageJson.version

const program = new Command()

type InstallCommandOptions = {
  readonly tui?: boolean
  readonly claude?: InstallArgs["claude"]
  readonly openai?: InstallArgs["openai"]
  readonly gemini?: InstallArgs["gemini"]
  readonly copilot?: InstallArgs["copilot"]
  readonly platform?: InstallArgs["platform"]
  readonly opencodeZen?: InstallArgs["opencodeZen"]
  readonly zaiCodingPlan?: InstallArgs["zaiCodingPlan"]
  readonly kimiForCoding?: InstallArgs["kimiForCoding"]
  readonly opencodeGo?: InstallArgs["opencodeGo"]
  readonly bailianCodingPlan?: InstallArgs["bailianCodingPlan"]
  readonly minimaxCnCodingPlan?: InstallArgs["minimaxCnCodingPlan"]
  readonly minimaxCodingPlan?: InstallArgs["minimaxCodingPlan"]
  readonly vercelAiGateway?: InstallArgs["vercelAiGateway"]
  readonly codexAutonomous?: InstallArgs["codexAutonomous"]
  readonly skipAuth?: boolean
}

type RootCommandOptions = {
  readonly platform?: InstallArgs["platform"]
}

type DoctorCommandOptions = {
  readonly status?: boolean
  readonly verbose?: boolean
  readonly json?: boolean
  readonly platform?: DoctorOptions["target"]
}

export function resolveInstallArgs(
  options: InstallCommandOptions,
  invocationName: string | undefined = process.env.OMA_INVOCATION_NAME,
): InstallArgs {
  const defaultPlatform = invocationName === "lazycodex" || invocationName === "lazycodex-ai" ? "codex" : undefined

  return {
    tui: options.tui !== false,
    claude: options.claude,
    openai: options.openai,
    gemini: options.gemini,
    copilot: options.copilot,
    platform: options.platform ?? defaultPlatform,
    opencodeZen: options.opencodeZen,
    zaiCodingPlan: options.zaiCodingPlan,
    kimiForCoding: options.kimiForCoding,
    opencodeGo: options.opencodeGo,
    bailianCodingPlan: options.bailianCodingPlan,
    minimaxCnCodingPlan: options.minimaxCnCodingPlan,
    minimaxCodingPlan: options.minimaxCodingPlan,
    vercelAiGateway: options.vercelAiGateway,
    codexAutonomous: options.codexAutonomous,
    skipAuth: options.skipAuth ?? false,
  }
}

program
  .name("oh-my-agent")
  .description("The ultimate OpenCode plugin - multi-model orchestration, LSP tools, and more")
  .version(VERSION, "-v, --version", "Show version number")
  .helpOption("-h, --help", "Display help for command")
  .addOption(new Option("--platform <platform>", "Install target platform: opencode, codex, both").choices(["opencode", "codex", "both"]).hideHelp())
  .enablePositionalOptions()

program
  .command("install")
  .alias("setup")
  .description("Install and configure oh-my-agent with interactive setup")
  .option("--no-tui", "Run in non-interactive mode (requires all options)")
  .option("--claude <value>", "Claude subscription: no, yes, max20")
  .option("--openai <value>", "OpenAI/ChatGPT subscription: no, yes (default: no)")
  .option("--gemini <value>", "Gemini integration: no, yes")
  .option("--copilot <value>", "GitHub Copilot subscription: no, yes")
  .addOption(new Option("--platform <platform>", "Install target platform: opencode, codex, both").choices(["opencode", "codex", "both"]))
  .option("--opencode-zen <value>", "OpenCode Zen access: no, yes (default: no)")
  .option("--zai-coding-plan <value>", "Z.ai Coding Plan subscription: no, yes (default: no)")
  .option("--kimi-for-coding <value>", "Kimi For Coding subscription: no, yes (default: no)")
  .option("--opencode-go <value>", "OpenCode Go subscription: no, yes (default: no)")
  .option("--bailian-coding-plan <value>", "Bailian Coding Plan subscription: no, yes (default: no)")
  .option("--minimax-cn-coding-plan <value>", "MiniMax Coding Plan (minimaxi.com) subscription: no, yes (default: no)")
  .option("--minimax-coding-plan <value>", "MiniMax Coding Plan (minimax.io) subscription: no, yes (default: no)")
  .option("--vercel-ai-gateway <value>", "Vercel AI Gateway: no, yes (default: no)")
  .option("--codex-autonomous", "Configure Codex with approval never, full filesystem access, and network enabled")
  .option("--no-codex-autonomous", "Leave existing Codex permission settings unchanged")
  .option("--skip-auth", "Skip authentication setup hints")
.addHelpText("after", `
Examples:
  $ bunx oh-my-agent install
  $ npx lazycodex-ai install --no-tui
  $ bunx oh-my-agent install --no-tui --platform=both --claude=max20 --openai=yes --gemini=yes --copilot=no
  $ omo install --platform=codex --codex-autonomous
  $ bunx oh-my-agent install --no-tui --claude=no --gemini=no --copilot=yes --opencode-zen=yes

Model Providers (Priority: Native > Copilot > OpenCode Zen > Z.ai > Kimi > Bailian > MiniMax > Vercel):
  Claude        Native anthropic/ models (Opus, Sonnet, Haiku)
  OpenAI        Native openai/ models (GPT-5.4 for Oracle)
  Gemini        Native google/ models (Gemini 3.1 Pro, Flash)
  Copilot       github-copilot/ models (fallback)
  OpenCode Zen  opencode/ models (opencode/claude-opus-4-7, etc.)
  Z.ai          zai-coding-plan/glm-5 (visual-engineering fallback)
  Kimi          kimi-for-coding/k2p5 (Sisyphus/Prometheus fallback)
  Bailian       bailian-coding-plan/ models (Qwen, GLM, Kimi fallback)
  MiniMax       minimax-coding-plan/MiniMax-M3 (utility fallback)
  MiniMax CN    minimax-cn-coding-plan/MiniMax-M3 (utility fallback)
  Vercel        vercel/ models (universal proxy, always last fallback)
`)
  .action(async (options: InstallCommandOptions) => {
    const rootOptions = program.opts<RootCommandOptions>()
    const args = resolveInstallArgs({ ...options, platform: options.platform ?? rootOptions.platform })
    const exitCode = await install(args)
    process.exit(exitCode)
  })

program
   .command("run <message>")
   .allowUnknownOption()
   .passThroughOptions()
  .description("Run opencode with todo/background task completion enforcement")
  .option("-a, --agent <name>", "Agent to use (default: from CLI/env/config, fallback: Sisyphus)")
  .option("-m, --model <provider/model>", "Model override (e.g., anthropic/claude-sonnet-4)")
  .option("-d, --directory <path>", "Working directory")
  .option("-p, --port <port>", "Server port (attaches if port already in use)", parseInt)
  .option("--attach <url>", "Attach to existing opencode server URL")
  .option("--on-complete <command>", "Shell command to run after completion")
  .option("--json", "Output structured JSON result to stdout")
  .option("--no-timestamp", "Disable timestamp prefix in run output")
  .option("--verbose", "Show full event stream (default: messages/tools only)")
  .option("--session-id <id>", "Resume existing session instead of creating new one")
  .addHelpText("after", `
Examples:
  $ bunx oh-my-agent run "Fix the bug in index.ts"
  $ bunx oh-my-agent run --agent Sisyphus "Implement feature X"
  $ bunx oh-my-agent run --port 4321 "Fix the bug"
  $ bunx oh-my-agent run --attach http://127.0.0.1:4321 "Fix the bug"
  $ bunx oh-my-agent run --json "Fix the bug" | jq .sessionId
  $ bunx oh-my-agent run --on-complete "notify-send Done" "Fix the bug"
  $ bunx oh-my-agent run --session-id ses_abc123 "Continue the work"
  $ bunx oh-my-agent run --model anthropic/claude-sonnet-4 "Fix the bug"
  $ bunx oh-my-agent run --agent Sisyphus --model openai/gpt-5.5 "Implement feature X"

Agent resolution order:
  1) --agent flag
  2) OPENCODE_DEFAULT_AGENT
  3) oh-my-agent.json "default_run_agent"
  4) Sisyphus (fallback)

Available core agents:
  Sisyphus, Hephaestus, Prometheus, Atlas

Unlike 'opencode run', this command waits until:
  - All todos are completed or cancelled
  - All child sessions (background tasks) are idle
`)
  .action(async (message: string, options) => {
    if (options.port && options.attach) {
      console.error("Error: --port and --attach are mutually exclusive")
      process.exit(1)
    }
    const runOptions: RunOptions = {
      message,
      agent: options.agent,
      model: options.model,
      directory: options.directory,
      port: options.port,
      attach: options.attach,
      onComplete: options.onComplete,
      json: options.json ?? false,
      timestamp: options.timestamp ?? true,
      verbose: options.verbose ?? false,
      sessionId: options.sessionId,
    }
    const exitCode = await run(runOptions)
    process.exit(exitCode)
  })

program
  .command("doctor")
  .description("Check oh-my-agent installation health and diagnose issues")
  .option("--status", "Show compact system dashboard")
  .option("--verbose", "Show detailed diagnostic information")
  .option("--json", "Output results in JSON format")
  .addOption(new Option("--platform <platform>", "Doctor target platform: opencode, codex").choices(["opencode", "codex"]))
  .addHelpText("after", `
Examples:
  $ bunx oh-my-agent doctor            # Show problems only
  $ bunx oh-my-agent doctor --status   # Compact dashboard
  $ bunx oh-my-agent doctor --verbose  # Deep diagnostics
  $ bunx oh-my-agent doctor --json     # JSON output
  $ omo doctor --platform=codex           # Codex/LazyCodex diagnostics only
`)
  .action(async (options: DoctorCommandOptions) => {
    const rootOptions = program.opts<RootCommandOptions>()
    const rootDoctorPlatform = rootOptions.platform === "opencode" || rootOptions.platform === "codex" ? rootOptions.platform : undefined
    const mode = options.status ? "status" : options.verbose ? "verbose" : "default"
    const doctorOptions: DoctorOptions = {
      mode,
      json: options.json ?? false, target: resolveDoctorTarget(process.env.OMA_INVOCATION_NAME, options.platform ?? rootDoctorPlatform),
    }
    const exitCode = await doctor(doctorOptions)
    process.exit(exitCode)
  })

program
  .command("cost")
  .description("Show token usage and cost summary")
  .option("-s, --session <id>", "Show cost for a specific session")
  .option("-a, --agent <name>", "Show cost for a specific agent (requires --session)")
  .option("--json", "Output results in JSON format")
  .addHelpText("after", `
Examples:
  $ bunx oh-my-agent cost                  # Show all costs
  $ bunx oh-my-agent cost --session abc123  # Show session cost
  $ bunx oh-my-agent cost -s abc123 -a Sisyphus  # Show agent cost
  $ bunx oh-my-agent cost --json           # JSON output
`)
  .action(async (options) => {
    await costCommand({
      session: options.session,
      agent: options.agent,
      json: options.json ?? false,
    })
  })

program
  .command("journal")
  .description("View and manage failure journal entries")
  .option("-f, --file <path>", "Show known issues for a specific file")
  .option("-l, --limit <n>", "Number of recent failures to show", parseInt)
  .option("--resolve <id>", "Mark a failure as resolved")
  .option("--record", "Record a new failure (requires other flags)")
  .option("--session-id <id>", "Session ID for recording")
  .option("--root-cause <text>", "Root cause description for recording")
  .option("--pattern <type>", "Failure pattern: race-condition, off-by-one, stale-cache, null-reference, type-error, logic-error, performance, security, other")
  .option("--fix <text>", "Fix description for recording")
  .option("--reported-by <who>", "Reporter: the-auditor, cold-eyes, user")
  .option("--file-path <path>", "File path for recording")
  .option("--json", "Output results in JSON format")
  .addHelpText("after", `
Examples:
  $ bunx oh-my-agent journal                        # Show recent failures
  $ bunx oh-my-agent journal --file src/foo.ts      # Issues for a file
  $ bunx oh-my-agent journal --resolve fj_xxx       # Mark resolved
  $ bunx oh-my-agent journal --json                 # JSON output
`)
  .action(async (options) => {
    await journalCommand({
      file: options.file,
      limit: options.limit,
      resolve: options.resolve,
      record: options.record,
      sessionId: options.sessionId,
      rootCause: options.rootCause,
      pattern: options.pattern,
      fix: options.fix,
      reportedBy: options.reportedBy,
      filePath: options.filePath,
      json: options.json ?? false,
    })
  })

const configCommand = program
  .command("config")
  .description("Manage oh-my-agent configuration")

configCommand
  .command("export")
  .description("Export current config to a file or stdout (sensitive fields redacted)")
  .option("-o, --output <file>", "Write to file (default: stdout)")
  .addOption(new Option("-f, --format <format>", "Output format").choices(["json", "jsonc"]).default("json"))
  .addHelpText("after", `
Examples:
  $ oh-my-agent config export                          # Print to stdout
  $ oh-my-agent config export -o config.json           # Write to file
  $ oh-my-agent config export -f jsonc -o config.jsonc # JSONC format
`)
  .action(async (options) => {
    await configExportCommand({
      output: options.output,
      format: options.format,
    })
  })

configCommand
  .command("import <file>")
  .description("Import config from a file (validates, backs up existing, merges or replaces)")
  .option("-m, --merge", "Merge with existing config instead of replacing")
  .addHelpText("after", `
Examples:
  $ oh-my-agent config import config.json            # Replace config
  $ oh-my-agent config import config.json --merge    # Merge with existing
`)
  .action(async (file: string, options) => {
    await configImportCommand(file, {
      merge: options.merge ?? false,
    })
  })

configureRuntimeCommands(program)

export function runCli(): void {
  program.parse()
}
