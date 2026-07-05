#!/usr/bin/env bash
# oh-my-agent uninstaller for Unix (Linux / macOS)
# Removes the oh-my-agent plugin, config, and data files.
# Idempotent — safe to run multiple times.
set -euo pipefail

CONFIG_BASENAME="oh-my-agent"

# ── Helpers ──────────────────────────────────────────────────────────────────

log()   { printf '\033[1;34m[oh-my-agent]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[oh-my-agent] WARN:\033[0m %s\n' "$*" >&2; }
err()   { printf '\033[1;31m[oh-my-agent] ERROR:\033[0m %s\n' "$*" >&2; }
die()   { err "$@"; exit 1; }

usage() {
  cat <<'EOF'
oh-my-agent uninstaller

Usage:
  bash uninstall.sh [OPTIONS]

Options:
  --help              Show this help message
  --keep-config       Keep config files (oh-my-agent.jsonc)
  --keep-data         Keep data files (cost-tracker.jsonl, failure-journal.jsonl)
  --dry-run           Show what would be removed without deleting

Removes:
  - Plugin directory (~/.local/share/oh-my-agent)
  - Config files (~/.config/oh-my-agent/ or XDG_CONFIG_HOME/oh-my-agent/)
  - Data files (~/.local/share/oh-my-agent-data/ or XDG_DATA_HOME/oh-my-agent/)
  - OpenCode plugin entry (if present)
EOF
}

# ── Parse args ───────────────────────────────────────────────────────────────

KEEP_CONFIG=false
KEEP_DATA=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help) usage; exit 0 ;;
    --keep-config) KEEP_CONFIG=true; shift ;;
    --keep-data) KEEP_DATA=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) die "Unknown option: $1 (use --help for usage)" ;;
  esac
done

# ── Resolve paths ───────────────────────────────────────────────────────────

# Config directory
if [[ -n "${XDG_CONFIG_HOME:-}" ]]; then
  CONFIG_DIR="$XDG_CONFIG_HOME/$CONFIG_BASENAME"
elif [[ "$(uname)" == "Darwin" ]]; then
  CONFIG_DIR="$HOME/Library/Application Support/$CONFIG_BASENAME"
else
  CONFIG_DIR="$HOME/.config/$CONFIG_BASENAME"
fi

# Data directory (plugin install + data files)
if [[ -n "${XDG_DATA_HOME:-}" ]]; then
  DATA_DIR="$XDG_DATA_HOME/$CONFIG_BASENAME"
else
  DATA_DIR="$HOME/.local/share/$CONFIG_BASENAME"
fi

# OpenCode plugin directory
OPENCODE_PLUGIN_DIR="$HOME/.config/opencode/plugins/oh-my-agent"

# ── Remove files ────────────────────────────────────────────────────────────

remove_path() {
  local path="$1"
  local label="$2"
  if [[ -e "$path" ]]; then
    if $DRY_RUN; then
      log "[dry-run] Would remove: $path"
    else
      log "Removing $label: $path"
      rm -rf "$path"
    fi
  else
    log "Already clean: $path"
  fi
}

log "Uninstalling oh-my-agent..."
$DRY_RUN && log "(dry run — no files will be deleted)"

# Plugin directory
remove_path "$DATA_DIR" "plugin directory"

# OpenCode plugin entry
remove_path "$OPENCODE_PLUGIN_DIR" "OpenCode plugin entry"

# Config files (unless --keep-config)
if $KEEP_CONFIG; then
  log "Keeping config files (--keep-config): $CONFIG_DIR"
else
  remove_path "$CONFIG_DIR" "config directory"
fi

# Data files (unless --keep-data)
if $KEEP_DATA; then
  log "Keeping data files (--keep-data)"
else
  # Cost tracker and failure journal may be in data dir or config dir
  for f in cost-tracker.jsonl cost-tracker.jsonl.1 failure-journal.jsonl failure-journal.jsonl.1; do
    remove_path "$DATA_DIR/$f" "data file"
    remove_path "$CONFIG_DIR/$f" "data file"
  done
done

# ── Done ────────────────────────────────────────────────────────────────────

log "Uninstall complete."
if $KEEP_CONFIG || $KEEP_DATA; then
  log "Some files were kept. Remove them manually if desired."
fi
