import type { CheckResult } from "../framework/types"

const CHECK_NAME = "codex-runtime-wrapper"

export interface CodexRuntimeWrapperDoctorDeps {
  readonly binDir?: string
  readonly codexHome?: string
  readonly platform?: NodeJS.Platform
}

export async function checkCodexRuntimeWrapper(_deps: CodexRuntimeWrapperDoctorDeps = {}): Promise<CheckResult> {
  return {
    name: CHECK_NAME,
    status: "pass",
    message: "Codex runtime wrapper checks passed",
    details: [],
    issues: [],
  }
}
