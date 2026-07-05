#Requires -Version 5.1
<#
.SYNOPSIS
    oh-my-agent installer for Windows (PowerShell).

.DESCRIPTION
    Installs the oh-my-agent OpenCode plugin from source or release.
    Idempotent - safe to run multiple times.

.PARAMETER Help
    Show this help message.

.PARAMETER Dir
    Override install directory (default: $env:LOCALAPPDATA\oh-my-agent).

.PARAMETER SkipBuild
    Skip the build step (use if already built).

.PARAMETER NoSuperpowers
    Skip cloning the superpowers skills repo.

.PARAMETER Force
    Force re-install even if plugin is already present.

.EXAMPLE
    .\install.ps1
    .\install.ps1 -Dir C:\tools\oh-my-agent
    .\install.ps1 -SkipBuild
#>
param(
    [switch]$Help,
    [string]$Dir,
    [switch]$SkipBuild,
    [switch]$NoSuperpowers,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Helpers

function Write-Log   { param([string]$Msg) Write-Host "[oh-my-agent] $Msg" -ForegroundColor Cyan }
function Write-Warn  { param([string]$Msg) Write-Host "[oh-my-agent] WARN: $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "[oh-my-agent] ERROR: $Msg" -ForegroundColor Red }
function Write-Die   { param([string]$Msg) Write-Err $Msg; exit 1 }

function Show-Usage {
    $help = @"
oh-my-agent installer

Usage:
  .\install.ps1 [OPTIONS]

Options:
  -Help              Show this help message
  -Dir <path>        Override install directory (default: `$env:LOCALAPPDATA\oh-my-agent)
  -SkipBuild         Skip the build step (use if already built)
  -NoSuperpowers     Skip cloning the superpowers skills repo
  -Force             Force re-install even if plugin is already present

Examples:
  .\install.ps1
  .\install.ps1 -Dir C:\tools\oh-my-agent
  .\install.ps1 -SkipBuild
"@
    Write-Host $help
}

if ($Help) {
    Show-Usage
    exit 0
}

# Defaults

$RepoUrl = "https://github.com/keypaa/oh-my-agent.git"
$InstallDir = if ($Dir) { $Dir } else { Join-Path $env:LOCALAPPDATA "oh-my-agent" }
$ConfigBasename = "oh-my-agent"

# Detect config directory

function Get-OpenCodeConfigDir {
    $appData = $env:APPDATA
    if (-not $appData) {
        $appData = Join-Path $env:USERPROFILE "AppData\Roaming"
    }
    return Join-Path $appData "opencode"
}

$OpenCodeConfigDir = Get-OpenCodeConfigDir

# Check prerequisites

Write-Log "checking prerequisites..."

$missing = @()
foreach ($tool in @("git")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Err "required tool '$tool' not found on PATH"
        $missing += $tool
    }
}

$hasBun = [bool](Get-Command "bun" -ErrorAction SilentlyContinue)
$hasNode = [bool](Get-Command "node" -ErrorAction SilentlyContinue)

if ($hasBun) {
    $bunVer = & bun --version 2>$null
    Write-Log "found bun $bunVer"
} elseif ($hasNode) {
    $nodeVer = & node --version 2>$null
    Write-Log "found node $nodeVer"
} else {
    Write-Die "neither 'bun' nor 'node' found on PATH - install one and re-run"
}

if ($missing.Count -gt 0) {
    Write-Die "install missing tools ($($missing -join ', ')) and re-run"
}

# Clone or update repo

if (-not (Test-Path (Join-Path $InstallDir ".git"))) {
    Write-Log "cloning repository to $InstallDir ..."
    $parentDir = Split-Path $InstallDir -Parent
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    & git clone --depth 1 $RepoUrl $InstallDir
    if ($LASTEXITCODE -ne 0) { Write-Die "git clone failed" }
} else {
    if ($Force) {
        Write-Log "force mode: pulling latest changes..."
        Push-Location $InstallDir
        & git pull --ff-only
        Pop-Location
        if ($LASTEXITCODE -ne 0) { Write-Warn "pull failed, using existing code" }
    } else {
        Write-Log "repository already exists at $InstallDir (use -Force to update)"
    }
}

# Install dependencies

Push-Location $InstallDir
try {
    if ($hasBun) {
        Write-Log "installing dependencies with bun..."
        & bun install --ignore-scripts
    } else {
        Write-Log "installing dependencies with npm..."
        & npm install --ignore-scripts
    }
} finally {
    Pop-Location
}

# Build

if (-not $SkipBuild) {
    $distIndex = Join-Path $InstallDir "dist\index.js"
    if (-not (Test-Path $distIndex) -or $Force) {
        Write-Log "building plugin..."
        Push-Location $InstallDir
        try {
            if ($hasBun) {
                & bun run build
            } else {
                & npm run build
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Log "dist\index.js already exists, skipping build (use -Force to rebuild)"
    }
} else {
    Write-Log "skipping build (-SkipBuild)"
}

# Copy plugin to OpenCode plugins directory

$PluginDest = Join-Path $OpenCodeConfigDir "plugins\oh-my-agent"

if ((Test-Path $PluginDest) -and -not $Force) {
    Write-Log "plugin already installed at $PluginDest (use -Force to overwrite)"
} else {
    Write-Log "copying plugin to $PluginDest ..."
    if (-not (Test-Path $PluginDest)) {
        New-Item -ItemType Directory -Path $PluginDest -Force | Out-Null
    }

    # Copy dist, bin, and package.json
    $distSource = Join-Path $InstallDir "dist"
    if (Test-Path $distSource) {
        Copy-Item -Path $distSource -Destination $PluginDest -Recurse -Force
    } else {
        Write-Warn "dist\ not found - did build succeed?"
    }

    $binSource = Join-Path $InstallDir "bin"
    if (Test-Path $binSource) {
        Copy-Item -Path $binSource -Destination $PluginDest -Recurse -Force
    }

    Copy-Item -Path (Join-Path $InstallDir "package.json") -Destination $PluginDest -Force

    $postinstall = Join-Path $InstallDir "postinstall.mjs"
    if (Test-Path $postinstall) {
        Copy-Item -Path $postinstall -Destination $PluginDest -Force
    }

    # Copy skills and commands
    foreach ($dir in @(".opencode\command", ".opencode\skills", ".agents\command", ".agents\skills")) {
        $src = Join-Path $InstallDir $dir
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $PluginDest -Recurse -Force
        }
    }

    # Copy MCP packages
    foreach ($pkg in @("lsp-tools-mcp", "lsp-daemon", "git-bash-mcp", "shared-skills")) {
        $src = Join-Path $InstallDir "packages\$pkg"
        $dest = Join-Path $PluginDest "packages\$pkg"
        if (Test-Path $src) {
            if (-not (Test-Path $dest)) {
                New-Item -ItemType Directory -Path $dest -Force | Out-Null
            }
            $pkgJson = Join-Path $src "package.json"
            if (Test-Path $pkgJson) { Copy-Item -Path $pkgJson -Destination $dest -Force }
            $pkgDist = Join-Path $src "dist"
            if (Test-Path $pkgDist) { Copy-Item -Path $pkgDist -Destination $dest -Recurse -Force }
            $pkgIndex = Join-Path $src "index.mjs"
            if (Test-Path $pkgIndex) { Copy-Item -Path $pkgIndex -Destination $dest -Force }
            $pkgSkills = Join-Path $src "skills"
            if (Test-Path $pkgSkills) { Copy-Item -Path $pkgSkills -Destination $dest -Recurse -Force }
        }
    }

    Write-Log "plugin installed to $PluginDest"
}

# Register plugin in OpenCode config

$OpenCodeConfig = Join-Path $OpenCodeConfigDir "opencode.json"

if (Test-Path $OpenCodeConfig) {
    $configContent = Get-Content $OpenCodeConfig -Raw | ConvertFrom-Json
    $plugins = @($configContent.plugin)
    if ($plugins -contains "oh-my-agent") {
        Write-Log "plugin already registered in $OpenCodeConfig"
    } else {
        Write-Log "registering plugin in $OpenCodeConfig ..."
        $plugins += "oh-my-agent"
        $configContent.plugin = $plugins
        $configContent | ConvertTo-Json -Depth 20 | Set-Content $OpenCodeConfig -Encoding UTF8
        Write-Log "registered oh-my-agent plugin"
    }
} else {
    Write-Warn "OpenCode config not found at $OpenCodeConfig, plugin registration skipped"
    Write-Warn "run 'oh-my-agent install' to complete setup"
}

# Create default oh-my-agent config if missing

$OmoConfig = Join-Path $OpenCodeConfigDir "$ConfigBasename.json"

if (-not (Test-Path $OmoConfig)) {
    Write-Log "creating default config at $OmoConfig ..."
    $defaultConfig = @{
        '$schema' = "https://raw.githubusercontent.com/code-yeongyu/oh-my-agent/dev/assets/oh-my-agent.schema.json"
        cost_tracker = @{ enabled = $true; max_file_size_mb = 10 }
        failure_journal = @{ enabled = $true; max_age_days = 90 }
        model_tier = @{
            cheap = @("explore", "librarian", "sisyphus-junior")
            medium = @("momus", "metis", "cold-eyes")
            expensive = @("sisyphus", "hephaestus", "the-auditor", "ml-ai-engineering")
        }
    }
    $defaultConfig | ConvertTo-Json -Depth 10 | Set-Content $OmoConfig -Encoding UTF8
    Write-Log "default config created"
} else {
    Write-Log "config already exists at $OmoConfig"
}

# Clone superpowers skills (optional)

if (-not $NoSuperpowers) {
    $skillCache = Join-Path $env:LOCALAPPDATA "opencode\skills"
    $superpowersDir = Join-Path $skillCache "superpowers"
    if (-not (Test-Path $superpowersDir)) {
        Write-Log "cloning superpowers skills..."
        if (-not (Test-Path $skillCache)) {
            New-Item -ItemType Directory -Path $skillCache -Force | Out-Null
        }
        & git clone --depth 1 "https://github.com/obra/superpowers.git" $superpowersDir 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "failed to clone superpowers (non-fatal)"
        }
    } else {
        Write-Log "superpowers already cloned at $superpowersDir"
    }
}

# Done

Write-Log "installation complete!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Ensure your API keys are set in your OpenCode config or environment"
Write-Host "  2. Run 'oh-my-agent doctor' to verify the installation"
Write-Host "  3. Start using oh-my-agent in OpenCode"
Write-Host ""
Write-Host "Documentation: https://github.com/keypaa/oh-my-agent#readme"
