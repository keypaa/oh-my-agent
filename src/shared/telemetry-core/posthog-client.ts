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

export function createTelemetryClient(_input: CreateTelemetryClientInput): TelemetryClient {
  return {
    enabled: false,
    trackActive: (_input: { dayUTC: string; distinctId: string; reason: string }) => {},
    flush: async () => {},
    shutdown: async () => {},
  }
}

export function isTelemetryClientEnabled(_input: { product: TelemetryProductConfig }): boolean {
  return false
}


