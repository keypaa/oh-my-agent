import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  DEFAULT_POSTHOG_API_KEY,
  DEFAULT_POSTHOG_HOST,
  createTelemetryClient,
  getTelemetryActivityStateFilePath,
  getTelemetryDistinctId,
  recordDailyActive,
} from "./index"
import type {
  TelemetryCaptureMessage,
  TelemetryOsProvider,
  TelemetryProductConfig,
  TelemetryTransport,
  TelemetryTransportFactory,
} from "./index"

const PRODUCT = {
  cacheDirName: "omo-codex",
  defaultApiKey: DEFAULT_POSTHOG_API_KEY,
  defaultHost: DEFAULT_POSTHOG_HOST,
  eventName: "OMA_codex_daily_active",
  machineIdPrefix: "omo-codex:",
  packageName: "#shared/omo-codex",
  packageVersion: "4.9.2",
  platform: "omo-codex",
  productName: "omo-codex",
  productEnvPrefix: "OMA_CODEX",
} satisfies TelemetryProductConfig

const OS_PROVIDER = {
  arch: () => "arm64",
  cpus: () => [{ model: "Apple M-test" }],
  hostname: () => "test-host",
  platform: () => "darwin",
  release: () => "26.0.0",
  totalmem: () => 17_179_869_184,
  type: () => "Darwin",
} satisfies TelemetryOsProvider

function createCapturingFactory(capturedMessages: TelemetryCaptureMessage[]): TelemetryTransportFactory {
  return () => ({
    capture: (message) => {
      capturedMessages.push(message)
    },
    flush: async () => undefined,
    shutdown: async () => undefined,
  })
}

describe("posthog telemetry client", () => {
  test("#given a state dir and fake transport #when daily active records twice same day #then only one event is sent", async () => {
    // given
    const capturedMessages: TelemetryCaptureMessage[] = []
    const stateDir = mkdtempSync(join(tmpdir(), "telemetry-core-record-"))

    try {
      const options = {
        env: { POSTHOG_API_KEY: "test-key" },
        now: new Date("2026-05-25T01:02:03.000Z"),
        osProvider: OS_PROVIDER,
        product: PRODUCT,
        reason: "session_start",
        source: "plugin",
        stateDir,
        transportFactory: createCapturingFactory(capturedMessages),
      } as const

      // when
      await recordDailyActive(options)
      await recordDailyActive(options)

      // then
      expect(capturedMessages).toHaveLength(1)
      const message = capturedMessages[0]
      if (message === undefined || message.properties === undefined) {
        throw new Error("expected one captured message with properties")
      }
      expect(message.properties.day_utc).toBe("2026-05-25")
      expect(message.properties.reason).toBe("session_start")
    } finally {
      rmSync(stateDir, { recursive: true, force: true })
    }
  })

  test("#given no API key after trimming #when client is created #then transport is not constructed", () => {
    // given
    let transportCreated = false

    // when
    const client = createTelemetryClient({
      env: { POSTHOG_API_KEY: " " },
      osProvider: OS_PROVIDER,
      product: PRODUCT,
      source: "install",
      transportFactory: () => {
        transportCreated = true
        const transport: TelemetryTransport = {
          capture: () => undefined,
          shutdown: async () => undefined,
        }
        return transport
      },
    })
    client.trackActive({
      dayUTC: "2026-05-25",
      distinctId: "distinct",
      reason: "install_completed",
    })

    // then
    expect(transportCreated).toBe(false)
  })

  test("#given telemetry is disabled #when daily active records #then dedup state is not written", async () => {
    // given
    const capturedMessages: TelemetryCaptureMessage[] = []
    const stateDir = mkdtempSync(join(tmpdir(), "telemetry-core-disabled-"))
    const stateFilePath = getTelemetryActivityStateFilePath(stateDir)

    try {
      // when
      await recordDailyActive({
        env: { OMA_CODEX_DISABLE_POSTHOG: "1", POSTHOG_API_KEY: "test-key" },
        now: new Date("2026-05-25T01:02:03.000Z"),
        osProvider: OS_PROVIDER,
        product: PRODUCT,
        reason: "session_start",
        source: "plugin",
        stateDir,
        transportFactory: createCapturingFactory(capturedMessages),
      })

      // then
      expect(capturedMessages).toHaveLength(0)
      expect(existsSync(stateFilePath)).toBe(false)
    } finally {
      rmSync(stateDir, { recursive: true, force: true })
    }
  })

  test("#given blank API key #when daily active records #then dedup state is not written", async () => {
    // given
    const capturedMessages: TelemetryCaptureMessage[] = []
    const stateDir = mkdtempSync(join(tmpdir(), "telemetry-core-no-key-"))
    const stateFilePath = getTelemetryActivityStateFilePath(stateDir)

    try {
      // when
      await recordDailyActive({
        env: { POSTHOG_API_KEY: " " },
        now: new Date("2026-05-25T01:02:03.000Z"),
        osProvider: OS_PROVIDER,
        product: PRODUCT,
        reason: "session_start",
        source: "plugin",
        stateDir,
        transportFactory: createCapturingFactory(capturedMessages),
      })

      // then
      expect(capturedMessages).toHaveLength(0)
      expect(existsSync(stateFilePath)).toBe(false)
    } finally {
      rmSync(stateDir, { recursive: true, force: true })
    }
  })
})
