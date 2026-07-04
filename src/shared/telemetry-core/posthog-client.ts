import { env } from "node:process"
import { shouldDisableTelemetry, getTelemetryApiKey, getTelemetryHost, hasTelemetryApiKey } from "./env"
import type {
  TelemetryCaptureMessage,
  TelemetryClient,
  TelemetryDiagnosticInput,
  TelemetryEnv,
  TelemetryOsProvider,
  TelemetryProductConfig,
  TelemetryTransport,
  TelemetryTransportFactory,
} from "./types"

export function createDefaultPostHogTransport(): TelemetryTransport {
  return {
    capture: (_message: TelemetryCaptureMessage) => {},
    flush: async () => {},
    shutdown: async () => {},
  }
}

export type CreateTelemetryClientInput = {
  readonly diagnostics?: (input: TelemetryDiagnosticInput) => void
  readonly env?: TelemetryEnv
  readonly osProvider?: TelemetryOsProvider
  readonly product: TelemetryProductConfig
  readonly source: string
  readonly transportFactory?: TelemetryTransportFactory
}

function createNoOpTelemetryClient(): TelemetryClient {
  return {
    enabled: false,
    trackActive: () => {},
    flush: async () => {},
    shutdown: async () => {},
  }
}

function collectSystemProperties(osProvider?: TelemetryOsProvider): Record<string, string | number | boolean> {
  if (osProvider === undefined) {
    return {}
  }

  let cpus: readonly { readonly model: string }[]
  try {
    cpus = osProvider.cpus()
  } catch {
    cpus = []
  }

  return {
    $os: osProvider.platform(),
    $os_version: osProvider.release(),
    os_arch: osProvider.arch(),
    os_type: osProvider.type(),
    cpu_count: cpus.length,
    cpu_model: cpus[0]?.model ?? "",
    total_memory_gb: Math.round(osProvider.totalmem() / (1024 * 1024 * 1024)),
  }
}

function collectEnvProperties(): Record<string, string | number | boolean> {
  const runtime = typeof process.versions?.bun === "string" ? "bun" : process.release?.name ?? "node"
  return {
    ci: Boolean(process.env.CI),
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    runtime,
    runtime_version: process.versions?.bun ?? process.version,
    shell: process.env.SHELL ?? "",
    terminal: process.env.TERM_PROGRAM ?? "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

export function createTelemetryClient(input: CreateTelemetryClientInput): TelemetryClient {
  const activeEnv = input.env ?? env

  if (shouldDisableTelemetry({ env: activeEnv, productEnvPrefix: input.product.productEnvPrefix })) {
    return createNoOpTelemetryClient()
  }

  const apiKey = getTelemetryApiKey(activeEnv, input.product.defaultApiKey)
  if (!hasTelemetryApiKey(activeEnv, input.product.defaultApiKey)) {
    return createNoOpTelemetryClient()
  }

  const transportFactory = input.transportFactory ?? createDefaultPostHogTransport
  let transport: TelemetryTransport
  try {
    transport = transportFactory(apiKey, {
      host: getTelemetryHost(activeEnv, input.product.defaultHost),
      disableGeoip: false,
      enableExceptionAutocapture: false,
      enableLocalEvaluation: false,
      strictLocalEvaluation: true,
      disableRemoteConfig: true,
      flushAt: 1,
      flushInterval: 0,
    })
  } catch {
    return createNoOpTelemetryClient()
  }

  return {
    enabled: true,
    trackActive: (trackInput) => {
      transport.capture({
        distinctId: trackInput.distinctId,
        event: input.product.eventName,
        properties: {
          day_utc: trackInput.dayUTC,
          reason: trackInput.reason,
          source: input.source,
          package_name: input.product.packageName,
          package_version: input.product.packageVersion,
          platform: input.product.platform,
          product_name: input.product.productName,
          $process_person_profile: false,
          ...collectSystemProperties(input.osProvider),
          ...collectEnvProperties(),
          ...input.product.additionalProperties,
        },
      })
    },
    flush: async () => {
      await transport.flush?.()
    },
    shutdown: async () => {
      await transport.shutdown()
    },
  }
}

export function isTelemetryClientEnabled(_input: { product: TelemetryProductConfig }): boolean {
  return true
}
