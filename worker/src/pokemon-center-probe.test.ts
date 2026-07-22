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
    const { formatProbeLogLine } = await import("./probe-utils.js")
    const line = formatProbeLogLine({
      status: 403,
      location: null,
      live: false,
      queueUrl: null,
      blocked: true,
      transport: "playwright-stealth",
      profile: "chromium-desktop-stealth",
      title: "Access Denied",
    })

    expect(line).toContain("transport=playwright-stealth")
    expect(line).toContain("profile=chromium-desktop-stealth")
    expect(line).toContain("blocked=Imperva")
  })

  it("formats probe errors without throwing", async () => {
    const { formatProbeError } = await import("./probe-utils.js")
    expect(formatProbeError(new Error("socket hang up"))).toBe("socket hang up")
    expect(formatProbeError("timeout")).toBe("timeout")
  })
})

describe("pokemon-center-probe reliability", () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env.PROXY_HOST = "geo.iproyal.com"
    process.env.PROXY_PORT = "12321"
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it("returns a safe non-live probe when navigation fails", async () => {
    const probeUtils = await import("./probe-utils.js")
    const probe = probeUtils.createNavigationFailureProbe()
    expect(probe.live).toBe(false)
    expect(probe.blocked).toBe(true)
    expect(probe.status).toBe(0)
    expect(probe.transport).toBe("playwright-stealth")
  })

  it("registers stealth plugin only once on playwright-extra chromium", async () => {
    vi.resetModules()
    const mod1 = await import("./pokemon-center-probe.js")
    const mod2 = await import("./pokemon-center-probe.js")

    mod1.ensureStealthChromium()
    mod2.ensureStealthChromium()

    expect(mod1.ensureStealthChromium()).toBe(mod2.ensureStealthChromium())
  })
})
