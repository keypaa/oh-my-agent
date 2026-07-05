type BashPattern = {
  regex: RegExp
  type: "read" | "env-dump" | "git-leak" | "copy-exfil" | "source"
}

const UNIX_READ: BashPattern[] = [
  { regex: /\bcat\s+(?!-)\S+/, type: "read" },
  { regex: /\bhead\s+(-n\s+\d+\s+)?\S+/, type: "read" },
  { regex: /\btail\s+(-n\s+\d+\s+)?\S+/, type: "read" },
  { regex: /\bmore\s+\S+/, type: "read" },
  { regex: /\bless\s+\S+/, type: "read" },
]

const WINDOWS_READ: BashPattern[] = [
  { regex: /\btype\s+\S+/, type: "read" },
  { regex: /\bGet-Content\s+\S+/, type: "read" },
  { regex: /\bGet-Content\s+['"][^'"]+['"]/, type: "read" },
  { regex: /\bfindstr\s+\S+\s+\S+/, type: "read" },
]

const ENV_DUMP: BashPattern[] = [
  { regex: /^\s*printenv\b/, type: "env-dump" },
  { regex: /^\s*env\s*(?:=|\s*$)/, type: "env-dump" },
  { regex: /^\s*set\s*$/, type: "env-dump" },
  { regex: /^\s*Get-ChildItem\s+Env:/, type: "env-dump" },
  { regex: /^\s*\[System\.Environment\]::GetEnvironmentVariables/, type: "env-dump" },
]

const GIT_LEAK: BashPattern[] = [
  { regex: /\bgit\s+show\b.*\b(\S+\.(env|pem|key|credentials|service-account))\b/, type: "git-leak" },
  { regex: /\bgit\s+diff\b.*\b(\S+\.(env|pem|key|credentials|service-account))\b/, type: "git-leak" },
  { regex: /\bgit\s+log\b.*\b-p\b.*\b(\S+\.(env|pem|key|credentials|service-account))\b/, type: "git-leak" },
]

const COPY_EXFIL: BashPattern[] = [
  { regex: /\b(?:cp|scp|rsync)\s+.*\b(\S+\.(env|pem|key|credentials))\b/, type: "copy-exfil" },
  { regex: /\bcurl\b.*\b(\S+\.(env|pem|key|credentials))\b/, type: "copy-exfil" },
  { regex: /\bwget\b.*\b(\S+\.(env|pem|key|credentials))\b/, type: "copy-exfil" },
]

const SOURCE: BashPattern[] = [
  { regex: /^\s*\.\s+\.env\b/, type: "source" },
  { regex: /^\s*source\s+\.env\b/, type: "source" },
  { regex: /^\s*\.\s+\.env\.\w+/, type: "source" },
  { regex: /^\s*source\s+\.env\.\w+/, type: "source" },
]

export const ALL_BASH_PATTERNS: BashPattern[] = [
  ...UNIX_READ,
  ...WINDOWS_READ,
  ...ENV_DUMP,
  ...GIT_LEAK,
  ...COPY_EXFIL,
  ...SOURCE,
]

export type MatchedPattern = {
  type: BashPattern["type"]
  pattern: RegExp
}

export function matchBashPatterns(command: string): MatchedPattern[] {
  const matches: MatchedPattern[] = []
  for (const pattern of ALL_BASH_PATTERNS) {
    if (pattern.regex.test(command)) {
      matches.push({ type: pattern.type, pattern: pattern.regex })
    }
  }
  return matches
}

export function extractPathFromBashCommand(command: string): string | undefined {
  const pathPatterns = [
    /\b(?:cat|head|tail|more|less|type|Get-Content|findstr)\s+(?:['"]?)([^'"\s|&;><]+)/,
    /\b(?:cp|scp|rsync)\s+(?:['"]?)([^'"\s|&;><]+)/,
    /\b(?:curl|wget)\s+.*?\s+(?:['"]?)([^'"\s|&;><]+\.(?:env|pem|key|credentials))/,
    /\.\s+(['"]?\.env(?:\.\w+)?['"]?)/,
    /\bsource\s+(['"]?\.env(?:\.\w+)?['"]?)/,
  ]
  for (const re of pathPatterns) {
    const m = command.match(re)
    if (m?.[1]) return m[1].replace(/^['"]|['"]$/g, "")
  }
  return undefined
}
