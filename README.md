# oh-my-agent

> AI-powered coding assistant plugin for OpenCode

## Features

- 14 specialized agents (Sisyphus, Hephaestus, Oracle, etc.)
- 53+ lifecycle hooks across 5 tiers
- 20+ config-gated tools
- Team Mode (parallel multi-agent coordination)
- Audit Loop (multi-verifier work validation)
- ML/AI Engineering skills
- Provenance Guard (source verification)
- Confidential File Guard + Secret Scanner
- Hashline edit (LINE#ID content hashing for zero stale-line errors)
- LSP integration (diagnostics, navigation, symbols, rename)
- AST-Grep (pattern-aware code search across 25 languages)
- Skill-embedded MCP servers
- Claude Code compatible (hooks, commands, skills, plugins)

## Installation

### Quick Install (Unix)

```bash
curl -fsSL https://raw.githubusercontent.com/keypaa/oh-my-agent/dev/install.sh | bash
```

### Quick Install (Windows)

```powershell
irm https://raw.githubusercontent.com/keypaa/oh-my-agent/dev/install.ps1 | iex
```

### Manual Install

```bash
git clone https://github.com/keypaa/oh-my-agent.git
cd oh-my-agent
bun install
bun run build
```

### Via OpenCode

Paste this into your agent session:

```
Install and configure oh-my-agent by following the instructions here:
https://raw.githubusercontent.com/keypaa/oh-my-agent/refs/heads/dev/docs/guide/installation.md
```

## Configuration

Create `.opencode/oh-my-agent.jsonc` in your project root:

```jsonc
{
  // Enable team mode for parallel agents
  "team_mode": {
    "enabled": true
  },

  // Customize agent behavior
  "agents": {
    "sisyphus": {
      "category": "coding"
    }
  }
}
```

## Agents

| Agent | Purpose | Cost |
|-------|---------|------|
| Sisyphus | Main orchestrator | Expensive |
| Hephaestus | Autonomous deep worker | Expensive |
| Oracle | Read-only consultation | Medium |
| Librarian | External docs search | Cheap |
| Explore | Codebase grep | Cheap |
| Atlas | Todo orchestrator | Medium |
| Prometheus | Strategic planner | Expensive |
| The-Auditor | Work verifier | Expensive |
| Cold-Eyes | Unbiased second verifier | Medium |
| ML-AI-Engineering | ML/AI specialist | Expensive |
| Sisyphus-Junior | Category-spawned executor | Medium |
| Metis | Pre-planning consultant | Medium |
| Momus | Plan reviewer | Medium |
| Multimodal-Looker | PDF/image analysis | Medium |
| Haruspex | Harness maintenance | Cheap |

## CLI

```bash
bunx oh-my-agent doctor      # Health diagnostics
bunx oh-my-agent cost        # Token usage summary
bunx oh-my-agent journal     # Failure journal
bunx oh-my-agent config export  # Export config
bunx oh-my-agent config import <file>  # Import config
```

## Working Modes

### Ultrawork Mode

Type `ultrawork` or `ulw`. The agent explores your codebase, researches patterns, implements the feature, verifies with diagnostics, and keeps working until done.

### Prometheus Mode

Press **Tab** to enter Prometheus mode. Prometheus interviews you like a real engineer, identifies scope and ambiguities, and builds a detailed plan before any code is written. Then run `/start-work` for full orchestration.

### Team Mode

Enable in config for parallel multi-agent coordination:

```jsonc
{
  "team_mode": {
    "enabled": true,
    "max_parallel_members": 4,
    "tmux_visualization": true
  }
}
```

## How It Works

```
User Request
    |
[IntentGate] -- Classifies intent
    |
[Sisyphus] -- Plans and delegates
    |
    +---> [Prometheus] -- Strategic planning
    +---> [Atlas] -- Todo orchestration
    +---> [Oracle] -- Architecture consultation
    +---> [Librarian] -- Documentation search
    +---> [Explore] -- Codebase grep
    +---> [Category agents] -- Specialized by task type
```

## License

MIT
