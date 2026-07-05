import * as fs from "fs"
import * as path from "path"
import * as os from "os"

interface UninstallOptions {
  keepConfig: boolean
  keepData: boolean
  dryRun: boolean
}

function getConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "oh-my-agent")
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "oh-my-agent")
  }
  return path.join(os.homedir(), ".config", "oh-my-agent")
}

function getDataDir(): string {
  if (process.env.XDG_DATA_HOME) {
    return path.join(process.env.XDG_DATA_HOME, "oh-my-agent")
  }
  if (process.platform === "win32") {
    return path.join(os.homedir(), "AppData", "Local", "oh-my-agent")
  }
  return path.join(os.homedir(), ".local", "share", "oh-my-agent")
}

function removePath(p: string, label: string, dryRun: boolean): void {
  if (fs.existsSync(p)) {
    if (dryRun) {
      console.log(`[dry-run] Would remove: ${p}`)
    } else {
      console.log(`Removing ${label}: ${p}`)
      fs.rmSync(p, { recursive: true, force: true })
    }
  }
}

export async function uninstallCommand(options: UninstallOptions): Promise<void> {
  const configDir = getConfigDir()
  const dataDir = getDataDir()

  console.log("Uninstalling oh-my-agent...")
  if (options.dryRun) {
    console.log("(dry run — no files will be deleted)")
  }

  // Plugin/data directory
  removePath(dataDir, "plugin directory", options.dryRun)

  // Config directory
  if (options.keepConfig) {
    console.log(`Keeping config files (--keep-config): ${configDir}`)
  } else {
    removePath(configDir, "config directory", options.dryRun)
  }

  // Data files in config dir
  if (!options.keepData) {
    for (const f of ["cost-tracker.jsonl", "cost-tracker.jsonl.1", "failure-journal.jsonl", "failure-journal.jsonl.1"]) {
      removePath(path.join(dataDir, f), "data file", options.dryRun)
      removePath(path.join(configDir, f), "data file", options.dryRun)
    }
  } else {
    console.log("Keeping data files (--keep-data)")
  }

  console.log("Uninstall complete.")
}
