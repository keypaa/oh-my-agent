---
name: customize-oma
description: "Living documentation for the oh-my-agent plugin. Use when adding skills, customizing agents, exporting/importing config, understanding plugin structure, or modifying hooks/tools. Triggers: 'customize oma', 'add a skill', 'how do I configure', 'plugin structure', 'what agents are available', 'export config', 'import config', 'oma docs'."
---

# Customize Oh-My-Agent

This skill is auto-maintained by **Haruspex** — the harness maintenance agent. It reflects the current state of the oh-my-agent plugin.

## Available Agents (15)

| Agent | Mode | Purpose |
|-------|------|---------|
| Sisyphus | primary | Main orchestrator — plans, delegates, reviews |
| Hephaestus | primary | Autonomous deep worker |
| Atlas | primary | Todo-list orchestrator |
| Prometheus | primary | Strategic planner (interview-based) |
| Oracle | subagent | Read-only consultant |
| Librarian | subagent | External docs/code search |
| Explore | subagent | Contextual grep |
| Multimodal-Looker | subagent | PDF/image analysis |
| Metis | subagent | Pre-planning consultant |
| Momus | subagent | Plan reviewer |
| Sisyphus-Junior | subagent | Category-spawned executor |
| The-Auditor | all | Work verifier (audit-loop verifier 1) |
| Cold-Eyes | subagent | Unbiased second verifier (audit-loop verifier 2) |
| ML-AI-Engineering | all | ML/AI specialist |
| Haruspex | subagent | Harness maintenance agent |

## How to Add a New Skill

1. Create a `SKILL.md` file in `.opencode/skills/` or `.agents/skills/`
2. Use YAML frontmatter with `name` and `description` fields
3. The `description` should include trigger phrases for auto-activation
4. Skills are auto-discovered from skill directories at session start
5. Skills can embed MCP servers via YAML frontmatter `mcp` section

### SKILL.md Template

```markdown
---
name: my-skill
description: "What this skill does. Triggers: 'trigger phrase 1', 'trigger phrase 2'."
---

# My Skill

## Instructions
[Detailed instructions for the agent]

## References
[Links to relevant files or documentation]
```

## How to Add a New Agent

1. Create `src/agents/{name}.ts` with `create{Name}Agent(model) → AgentConfig`
2. Add the name to `BuiltinAgentName` type in `src/agents/types.ts`
3. Register in `src/agents/builtin-agents.ts` `agentSources` record
4. Add to `BuiltinAgentNameSchema` in `src/config/schema/agent-names.ts`
5. Add prompt metadata for Sisyphus delegation table

## How to Customize Agents

Edit your config file (`~/.config/opencode/oh-my-agent.jsonc` or project `.opencode/oh-my-agent.jsonc`):

```jsonc
{
  "agents": {
    "sisyphus": {
      "model": "anthropic/claude-opus-4-7",
      "prompt_append": "Always use TypeScript.",
      "skills": ["frontend", "debugging"]
    }
  }
}
```

### Per-Agent Config Fields

- `model` — Override the default model
- `variant` — Model variant (e.g., "medium", "high")
- `temperature` — Sampling temperature
- `prompt_append` — Extra instructions added to the system prompt
- `skills` — Skills to auto-load for this agent
- `tools` — Enable/disable specific tools
- `category` — Default category for delegation
- `fallback_models` — Custom fallback chain

## How to Export/Import Config

### Export

```bash
oh-my-agent config export --output ~/dotfiles/oma-profile.jsonc
```

The exported file:
- Strips secrets (prompts you to re-enter API keys)
- Template-izes paths (`{homeDir}`, `{os}`, `{arch}`)
- Includes: provider configs, agent overrides, skill selections, disabled features

### Import

```bash
oh-my-agent install --config ~/dotfiles/oma-profile.jsonc
```

## Config Schema

All config fields are optional. Defaults are filled by Zod safeParse.

- Root schema: `src/config/schema/oh-my-agent-config.ts`
- Config loaded from: user (`~/.config/opencode/oh-my-agent.jsonc`) + walked project configs
- Run `bun run build:schema` to regenerate `assets/oh-my-agent.schema.json`

## Available Skills (builtin)

| Skill | Purpose |
|-------|---------|
| debugging | Hypothesis-driven debugging |
| frontend | Visual design guidance |
| git-master | Git operations |
| review-work | Code review |
| init-deep | Initialize deep work |
| remove-ai-slops | Clean AI-generated patterns |
| ast-grep | Structural code search |
| visual-qa | Visual quality assurance |
| lsp-setup | LSP server configuration |
| ml-ai-* | 6 ML/AI specialist skills |

## Hooks (5-tier architecture)

| Tier | Count | Purpose |
|------|-------|---------|
| Session | ~22 | Session lifecycle, model fallback, notifications |
| Tool Guard | ~17 | Pre/post tool execution guards |
| Transform | 3 | Message transforms, keyword detection |
| Continuation | ~7 | Audit loop, babysitter, compaction |
| Skill | 2 | Skill awareness, auto-slash-commands |

## MCP System (3-tier)

| Tier | Source | Examples |
|------|--------|----------|
| Built-in | `src/mcp/` | LSP, codegraph |
| Claude Code | `.mcp.json` | User-configured MCPs |
| Skill-embedded | SKILL.md frontmatter | Per-session MCPs |

## CLI Commands

| Command | Purpose |
|---------|---------|
| `install` | Setup wizard |
| `run <message>` | Non-interactive session |
| `doctor` | Health diagnostics |
| `config export` | Export config as portable profile |
| `version` | Print plugin version |
