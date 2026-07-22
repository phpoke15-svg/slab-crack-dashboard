import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("pokemon-center-probe logging", () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env.PROXY_HOST = "geo.iproyal.com"
    process.env.PROXY_PORT = "12321"
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it("formats blocked Imperva responses cleanly", async () => {
    const { formatProbeLogLine } = await import("./pokemon-center-probe.js")
    const line = formatProbeLogLine({
      status: 403,
      location: null,
      live: false,
      queueUrl: null,
      blocked: true,
      transport: "got-scraping",
      profile: "firefox-desktop",
    })

    expect(line).toContain("transport=got-scraping")
    expect(line).toContain("profile=firefox-desktop")
    expect(line).toContain("blocked=Imperva")
  })

  it("formats probe errors without throwing", async () => {
    const { formatProbeError } = await import("./pokemon-center-probe.js")
    expect(formatProbeError(new Error("socket hang up"))).toBe("socket hang up")
    expect(formatProbeError("timeout")).toBe("timeout")
  })
})
