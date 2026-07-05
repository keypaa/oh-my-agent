#!/usr/bin/env bash
# oh-my-agent installer for Unix (Linux / macOS)
# Installs the oh-my-agent OpenCode plugin from source or release.
# Idempotent — safe to run multiple times.
set -euo pipefail

VERSION="0.1.0"
REPO_URL="https://github.com/keypaa/oh-my-agent.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/oh-my-agent}"
CONFIG_BASENAME="oh-my-agent"

# ── Helpers ──────────────────────────────────────────────────────────────────

log()   { printf '\033[1;34m[oh-my-agent]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[oh-my-agent] WARN:\033[0m %s\n' "$*" >&2; }
err()   { printf '\033[1;31m[oh-my-agent] ERROR:\033[0m %s\n' "$*" >&2; }
die()   { err "$@"; exit 1; }

usage() {
  cat <<'EOF'
oh-my-agent installer

Usage:
  bash install.sh [OPTIONS]

Options:
  --help              Show this help message
  --dir <path>        Override install directory (default: ~/.local/share/oh-my-agent)
  --skip-build        Skip the build step (use if already built)
  --no-superpowers    Skip cloning the superpowers skills repo
  --force             Force re-install even if plugin is already present

Examples:
  bash install.sh
  bash install.sh --dir /opt/oh-my-agent
  bash install.sh --skip-build
EOF
}

# ── Parse arguments ──────────────────────────────────────────────────────────

SKIP_BUILD=0
CLONE_SUPERPOWERS=1
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --dir)
      INSTALL_DIR="${2:---dir requires a path}"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --no-superpowers)
      CLONE_SUPERPOWERS=0
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    *)
      die "Unknown option: $1 (try --help)"
      ;;
  esac
done

# ── Detect platform config dir ──────────────────────────────────────────────

detect_config_dir() {
  case "$(uname -s)" in
    Darwin*)
      echo "$HOME/Library/Application Support/opencode"
      ;;
    *)
      if [[ -n "${XDG_CONFIG_HOME:-}" ]]; then
        echo "$XDG_CONFIG_HOME/opencode"
      else
        echo "$HOME/.config/opencode"
      fi
      ;;
  esac
}

OPENCODE_CONFIG_DIR="$(detect_config_dir)"

# ── Check prerequisites ─────────────────────────────────────────────────────

log "checking prerequisites..."

missing=0
for tool in git; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    err "required tool '$tool' not found on PATH"
    missing=1
  fi
done

# Need either bun or node
if command -v bun >/dev/null 2>&1; then
  log "found bun $(bun --version)"
elif command -v node >/dev/null 2>&1; then
  log "found node $(node --version)"
else
  err "neither 'bun' nor 'node' found on PATH — install one and re-run"
  missing=1
fi

if [[ "$missing" -ne 0 ]]; then
  die "install missing tools and re-run"
fi

# ── Clone or update repo ────────────────────────────────────────────────────

if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  log "cloning repository to $INSTALL_DIR ..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
else
  if [[ "$FORCE" -eq 1 ]]; then
    log "force mode: resetting to latest..."
    git -C "$INSTALL_DIR" fetch --depth 1 origin || warn "fetch failed"
    git -C "$INSTALL_DIR" reset --hard origin/$(git -C "$INSTALL_DIR" rev-parse --abbrev-ref HEAD) || warn "reset failed — using existing code"
  else
    log "repository already exists at $INSTALL_DIR (use --force to update)"
  fi
fi

cd "$INSTALL_DIR"

# ── Install dependencies ────────────────────────────────────────────────────

if command -v bun >/dev/null 2>&1; then
  log "installing dependencies with bun..."
  bun install --ignore-scripts
else
  log "installing dependencies with npm..."
  npm install --ignore-scripts
fi

# ── Build ───────────────────────────────────────────────────────────────────

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  if [[ ! -f "$INSTALL_DIR/dist/index.js" ]] || [[ "$FORCE" -eq 1 ]]; then
    log "building plugin..."
    if command -v bun >/dev/null 2>&1; then
      bun run build
    else
      npm run build
    fi
  else
    log "dist/index.js already exists — skipping build (use --force to rebuild)"
  fi
else
  log "skipping build (--skip-build)"
fi

# ── Copy plugin to OpenCode plugins directory ────────────────────────────────

PLUGIN_DEST="$OPENCODE_CONFIG_DIR/plugins/oh-my-agent"

if [[ -d "$PLUGIN_DEST" ]] && [[ "$FORCE" -eq 0 ]]; then
  log "plugin already installed at $PLUGIN_DEST (use --force to overwrite)"
else
  log "copying plugin to $PLUGIN_DEST ..."
  mkdir -p "$PLUGIN_DEST"

  # Copy dist, bin, and package.json
  cp -r "$INSTALL_DIR/dist" "$PLUGIN_DEST/" 2>/dev/null || warn "dist/ not found — did build succeed?"
  cp -r "$INSTALL_DIR/bin" "$PLUGIN_DEST/" 2>/dev/null || true
  cp "$INSTALL_DIR/package.json" "$PLUGIN_DEST/"
  cp "$INSTALL_DIR/postinstall.mjs" "$PLUGIN_DEST/" 2>/dev/null || true

  # Copy skills and commands
  for dir in .opencode/command .opencode/skills .agents/command .agents/skills; do
    if [[ -d "$INSTALL_DIR/$dir" ]]; then
      cp -r "$INSTALL_DIR/$dir" "$PLUGIN_DEST/"
    fi
  done

  # Copy MCP packages
  for pkg in lsp-tools-mcp lsp-daemon git-bash-mcp shared-skills; do
    src="$INSTALL_DIR/packages/$pkg"
    dest="$PLUGIN_DEST/packages/$pkg"
    if [[ -d "$src" ]]; then
      mkdir -p "$dest"
      cp -r "$src/package.json" "$dest/" 2>/dev/null || true
      cp -r "$src/dist" "$dest/" 2>/dev/null || true
      [[ -f "$src/index.mjs" ]] && cp "$src/index.mjs" "$dest/"
      [[ -d "$src/skills" ]] && cp -r "$src/skills" "$dest/"
    fi
  done

  log "plugin installed to $PLUGIN_DEST"
fi

# ── Add CLI to PATH ──────────────────────────────────────────────────────────

LOCAL_BIN="$HOME/.local/bin"
CLI_ENTRY="$PLUGIN_DEST/dist/cli/index.js"

if [[ -f "$CLI_ENTRY" ]]; then
  mkdir -p "$LOCAL_BIN"
  CLI_LINK="$LOCAL_BIN/oh-my-agent"
  cat > "$CLI_LINK" <<WRAPPER
#!/usr/bin/env bash
exec node "$CLI_ENTRY" "\$@"
WRAPPER
  chmod +x "$CLI_LINK"
  log "CLI linked to $CLI_LINK"

  # Warn if ~/.local/bin is not on PATH
  case ":$PATH:" in
    *":$LOCAL_BIN:"*) ;;
    *) warn "~/.local/bin is not on PATH — add it or run: export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
  esac
else
  warn "CLI entry not found at $CLI_ENTRY — oh-my-agent command not available"
fi

# ── Register plugin in OpenCode config ──────────────────────────────────────

OPENCODE_CONFIG="$OPENCODE_CONFIG_DIR/opencode.json"

if [[ -f "$OPENCODE_CONFIG" ]]; then
  # Check if oh-my-agent is already in the plugin list
  if grep -q '"oh-my-agent"' "$OPENCODE_CONFIG" 2>/dev/null; then
    log "plugin already registered in $OPENCODE_CONFIG"
  else
    log "registering plugin in $OPENCODE_CONFIG ..."
    # Use node/bun to safely add to the plugin array
    if command -v node >/dev/null 2>&1; then
      node -e "
        const fs = require('fs');
        const path = '$OPENCODE_CONFIG';
        const raw = fs.readFileSync(path, 'utf-8');
        const config = JSON.parse(raw);
        if (!config.plugin) config.plugin = [];
        if (!config.plugin.includes('oh-my-agent')) {
          config.plugin.push('oh-my-agent');
          fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
          console.log('registered oh-my-agent plugin');
        } else {
          console.log('plugin already registered');
        }
      "
    else
      warn "could not auto-register plugin — manually add 'oh-my-agent' to the plugin array in $OPENCODE_CONFIG"
    fi
  fi
else
  warn "OpenCode config not found at $OPENCODE_CONFIG — plugin registration skipped"
  warn "run 'oh-my-agent install' to complete setup"
fi

# ── Create default oh-my-agent config if missing ────────────────────────────

OMO_CONFIG="$OPENCODE_CONFIG_DIR/$CONFIG_BASENAME.json"

if [[ ! -f "$OMO_CONFIG" ]]; then
  log "creating default config at $OMO_CONFIG ..."
  cat > "$OMO_CONFIG" <<'DEFAULT_CONFIG'
{
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-agent/dev/assets/oh-my-agent.schema.json",
  "cost_tracker": { "enabled": true, "max_file_size_mb": 10 },
  "failure_journal": { "enabled": true, "max_age_days": 90 },
  "model_tier": {
    "cheap": ["explore", "librarian", "sisyphus-junior"],
    "medium": ["momus", "metis", "cold-eyes"],
    "expensive": ["sisyphus", "hephaestus", "the-auditor", "ml-ai-engineering"]
  }
}
DEFAULT_CONFIG
  log "default config created"
else
  log "config already exists at $OMO_CONFIG"
fi

# ── Clone superpowers skills (optional) ─────────────────────────────────────

if [[ "$CLONE_SUPERPOWERS" -eq 1 ]]; then
  SKILL_CACHE="$HOME/.cache/opencode/skills"
  SUPERPOWERS_DIR="$SKILL_CACHE/superpowers"
  if [[ ! -d "$SUPERPOWERS_DIR" ]]; then
    log "cloning superpowers skills..."
    mkdir -p "$SKILL_CACHE"
    git clone --depth 1 "https://github.com/obra/superpowers.git" "$SUPERPOWERS_DIR" 2>/dev/null || warn "failed to clone superpowers (non-fatal)"
  else
    log "superpowers already cloned at $SUPERPOWERS_DIR"
  fi
fi

# ── Done ────────────────────────────────────────────────────────────────────

log "installation complete!"
echo ""
echo "Next steps:"
echo "  1. Ensure your API keys are set in your OpenCode config or environment"
echo "  2. Run 'oh-my-agent doctor' to verify the installation"
echo "  3. Start using oh-my-agent in OpenCode"
echo ""
echo "Documentation: https://github.com/keypaa/oh-my-agent#readme"
