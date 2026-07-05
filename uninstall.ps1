# oh-my-agent uninstaller for Windows (PowerShell 5.1+)
# Removes the oh-my-agent plugin, config, and data files.
# Idempotent — safe to run multiple times.
param(
    [switch]$Help,
    [switch]$KeepConfig,
    [switch]$KeepData,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ConfigBasename = "oh-my-agent"

# ── Helpers ──────────────────────────────────────────────────────────────────

function Log($msg)  { Write-Host "[oh-my-agent] $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[oh-my-agent] WARN: $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[oh-my-agent] ERROR: $msg" -ForegroundColor Red }

function Show-Usage {
    @"
oh-my-agent uninstaller

Usage:
    .\uninstall.ps1 [OPTIONS]

Options:
    -Help              Show this help message
    -KeepConfig        Keep config files (oh-my-agent.jsonc)
    -KeepData          Keep data files (cost-tracker.jsonl, failure-journal.jsonl)
    -DryRun            Show what would be removed without deleting

Removes:
    - Plugin directory (%LOCALAPPDATA%\oh-my-agent)
    - Config files (%APPDATA%\oh-my-agent\ or %XDG_CONFIG_HOME%\oh-my-agent\)
    - Data files (cost-tracker.jsonl, failure-journal.jsonl)
    - OpenCode plugin entry (if present)
"@
}

if ($Help) { Show-Usage; exit 0 }

# ── Resolve paths ───────────────────────────────────────────────────────────

# Config directory
if ($env:XDG_CONFIG_HOME) {
    $ConfigDir = Join-Path $env:XDG_CONFIG_HOME $ConfigBasename
} else {
    $ConfigDir = Join-Path $env:APPDATA $ConfigBasename
}

# Data directory (plugin install + data files)
if ($env:XDG_DATA_HOME) {
    $DataDir = Join-Path $env:XDG_DATA_HOME $ConfigBasename
} else {
    $DataDir = Join-Path $env:LOCALAPPDATA $ConfigBasename
}

# OpenCode plugin directory
$OpenCodePluginDir = Join-Path $env:APPDATA "opencode\plugins\oh-my-agent"

# ── Remove files ────────────────────────────────────────────────────────────

function Remove-Path {
    param([string]$Path, [string]$Label)
    if (Test-Path $Path) {
        if ($DryRun) {
            Log "[dry-run] Would remove: $Path"
        } else {
            Log "Removing ${Label}: $Path"
            Remove-Item -Recurse -Force $Path
        }
    } else {
        Log "Already clean: $Path"
    }
}

Log "Uninstalling oh-my-agent..."
if ($DryRun) { Log "(dry run - no files will be deleted)" }

# Plugin directory
Remove-Path -Path $DataDir -Label "plugin directory"

# OpenCode plugin entry
Remove-Path -Path $OpenCodePluginDir -Label "OpenCode plugin entry"

# Config files (unless -KeepConfig)
if ($KeepConfig) {
    Log "Keeping config files (-KeepConfig): $ConfigDir"
} else {
    Remove-Path -Path $ConfigDir -Label "config directory"
}

# Data files (unless -KeepData)
if ($KeepData) {
    Log "Keeping data files (-KeepData)"
} else {
    foreach ($f in @("cost-tracker.jsonl", "cost-tracker.jsonl.1", "failure-journal.jsonl", "failure-journal.jsonl.1")) {
        $dataPath = Join-Path $DataDir $f
        $configPath = Join-Path $ConfigDir $f
        Remove-Path -Path $dataPath -Label "data file"
        Remove-Path -Path $configPath -Label "data file"
    }
}

# ── Done ────────────────────────────────────────────────────────────────────

Log "Uninstall complete."
if ($KeepConfig -or $KeepData) {
    Log "Some files were kept. Remove them manually if desired."
}
