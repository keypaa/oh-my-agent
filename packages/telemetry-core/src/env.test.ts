import { describe, expect, test } from "bun:test"

import { shouldDisableTelemetry } from "./index"

const OPT_OUT_CASES = [
  ["unset env enables telemetry", {}, false],
  ["global disable 1", { OMA_DISABLE_POSTHOG: "1" }, true],
  ["global disable true", { OMA_DISABLE_POSTHOG: "true" }, true],
  ["global disable yes", { OMA_DISABLE_POSTHOG: "yes" }, true],
  ["global send 0", { OMA_SEND_ANONYMOUS_TELEMETRY: "0" }, true],
  ["global send false", { OMA_SEND_ANONYMOUS_TELEMETRY: "false" }, true],
  ["global send no", { OMA_SEND_ANONYMOUS_TELEMETRY: "no" }, true],
  ["codex disable 1", { OMA_CODEX_DISABLE_POSTHOG: "1" }, true],
  ["codex disable true", { OMA_CODEX_DISABLE_POSTHOG: "true" }, true],
  ["codex disable yes", { OMA_CODEX_DISABLE_POSTHOG: "yes" }, true],
  ["codex send 0", { OMA_CODEX_SEND_ANONYMOUS_TELEMETRY: "0" }, true],
  ["codex send false", { OMA_CODEX_SEND_ANONYMOUS_TELEMETRY: "false" }, true],
  ["codex send no", { OMA_CODEX_SEND_ANONYMOUS_TELEMETRY: "no" }, true],
  ["approved codex send yes convergence", { OMA_CODEX_SEND_ANONYMOUS_TELEMETRY: "yes" }, true],
  ["invalid disable value", { OMA_CODEX_DISABLE_POSTHOG: "maybe" }, false],
] as const

describe("opt-out telemetry env matrix", () => {
  test.each(OPT_OUT_CASES)(
    "#given %s #when evaluated #then disabled=%p",
    (_name, env, expected) => {
      // given
      const productPrefix = "OMA_CODEX"

      // when
      const result = shouldDisableTelemetry({ env, productEnvPrefix: productPrefix })

      // then
      expect(result).toBe(expected)
    },
  )
})
