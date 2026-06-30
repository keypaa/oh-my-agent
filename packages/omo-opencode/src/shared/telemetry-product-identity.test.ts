import { describe, expect, it } from "bun:test"
import packageJson from "../../../../package.json" with { type: "json" }
import { PLUGIN_NAME } from "./plugin-identity"
import { createOpencodeTelemetryProductConfig } from "./telemetry-product-identity"

describe("createOpencodeTelemetryProductConfig", () => {
  it("pins the omo-opencode telemetry identity for zero data breakage", () => {
    // given
    const expectedVersion = packageJson.version

    // when
    const product = createOpencodeTelemetryProductConfig()

    // then
    expect(product).toMatchObject({
      cacheDirName: "oh-my-agent",
      eventName: "omo_daily_active",
      machineIdPrefix: "oh-my-agent:",
      packageName: "oh-my-agent",
      packageVersion: expectedVersion,
      platform: "oh-my-agent",
      productEnvPrefix: "OMO",
      productName: "oh-my-agent",
      additionalProperties: {
        plugin_name: PLUGIN_NAME,
      },
    })
  })
})
