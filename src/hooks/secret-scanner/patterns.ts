export type SecretPattern = {
  name: string
  regex: RegExp
  severity: "block" | "warn"
}

export const KNOWN_SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key",
    regex: /AKIA[0-9A-Z]{16}/,
    severity: "block",
  },
  {
    name: "OpenAI API Key",
    regex: /sk-[a-zA-Z0-9]{20,}/,
    severity: "block",
  },
  {
    name: "Anthropic API Key",
    regex: /sk-ant-[a-zA-Z0-9\-]{20,}/,
    severity: "block",
  },
  {
    name: "GitHub Token",
    regex: /gh[pousr]_[A-Za-z0-9_]{36,}/,
    severity: "block",
  },
  {
    name: "Slack Token",
    regex: /xox[bpars]-[0-9]{10,}-[a-zA-Z0-9\-]+/,
    severity: "block",
  },
  {
    name: "Stripe API Key",
    regex: /[sr]k_live_[0-9a-zA-Z]{24,}/,
    severity: "block",
  },
  {
    name: "Stripe Test Key",
    regex: /[sr]k_test_[0-9a-zA-Z]{24,}/,
    severity: "block",
  },
  {
    name: "npm Token",
    regex: /npm_[A-Za-z0-9]{36}/,
    severity: "block",
  },
  {
    name: "GCP Service Account Key",
    regex: /"type"\s*:\s*"service_account"/,
    severity: "block",
  },
  {
    name: "Database Connection String",
    regex: /(mysql|postgres|postgresql|mongodb|redis|mssql):\/\/[^:]+:[^@\s]+@/,
    severity: "block",
  },
  {
    name: "Private Key",
    regex: /-----BEGIN (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/,
    severity: "block",
  },
  {
    name: "Env Secret Assignment",
    regex: /(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIALS?|API_KEY|AUTH_TOKEN)\s*=\s*['"]?[^\s'"]{8,}['"]?/i,
    severity: "block",
  },
]

function shannonEntropy(data: string): number {
  if (data.length === 0) return 0
  const freq = new Map<string, number>()
  for (const ch of data) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1)
  }
  let entropy = 0
  const len = data.length
  for (const count of freq.values()) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return entropy
}

export function checkEntropy(text: string): { hasHighEntropy: boolean; entropy: number } {
  const entropy = shannonEntropy(text)
  return { hasHighEntropy: entropy > 4.0, entropy }
}

export type PatternMatch = {
  pattern: SecretPattern
  match: string
}

export function findKnownSecrets(content: string): PatternMatch[] {
  const results: PatternMatch[] = []
  for (const pattern of KNOWN_SECRET_PATTERNS) {
    const m = content.match(pattern.regex)
    if (m) {
      results.push({ pattern, match: m[0] })
    }
  }
  return results
}

const HIGH_ENTROPY_MIN_LENGTH = 32

export function findHighEntropyStrings(content: string): string[] {
  const results: string[] = []
  const wordRegex = /[a-zA-Z0-9+/=_\-]{32,}/g
  let m: RegExpExecArray | null
  while ((m = wordRegex.exec(content)) !== null) {
    const candidate = m[0]
    const { hasHighEntropy } = checkEntropy(candidate)
    if (hasHighEntropy) {
      results.push(candidate)
    }
  }
  return results
}
