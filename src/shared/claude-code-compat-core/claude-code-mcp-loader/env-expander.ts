const ALLOWED_VARS = new Set([
  "PATH", "HOME", "USER", "SHELL", "TERM", "TMPDIR", "TMP", "TEMP",
  "PWD", "OLDPWD", "LANG", "LC_ALL", "LC_CTYPE", "EDITOR", "VISUAL",
  "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME",
  "HOSTNAME", "LOGNAME", "USERPROFILE", "APPDATA", "LOCALAPPDATA",
])

function isAllowedMcpEnvVar(name: string): boolean {
  return ALLOWED_VARS.has(name)
}

function isSensitiveMcpEnvVar(name: string): boolean {
  return /KEY|TOKEN|SECRET|PASSWORD|AUTH|CREDENTIAL/i.test(name)
}

export interface ExpandEnvVarsOptions {
  trusted?: boolean
}

function expandEnvVars(value: string, options: ExpandEnvVarsOptions = {}): string {
  const { trusted = false } = options
  return value.replace(
    /\$\{([^}:]+)(?::-([^}]*))?\}/g,
    (_, varName: string, defaultValue?: string) => {
      if (!trusted && !isAllowedMcpEnvVar(varName)) {
        if (defaultValue !== undefined) return defaultValue
        return ""
      }
      const envValue = process.env[varName]
      if (envValue !== undefined) return envValue
      if (defaultValue !== undefined) return defaultValue
      return ""
    }
  )
}

export function expandEnvVarsInObject<T>(obj: T, options: ExpandEnvVarsOptions = {}): T {
  if (obj == null) return obj
  if (typeof obj === "string") return expandEnvVars(obj, options) as T
  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvVarsInObject(item, options)) as T
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value, options)
    }
    return result as T
  }
  return obj
}
