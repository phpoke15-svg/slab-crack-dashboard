import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("buildProxyUrl", () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it("builds IPRoyal proxy URL from IPROYAL_* env vars", async () => {
    process.env.IPROYAL_HOST = "geo.iproyal.com"
    process.env.IPROYAL_PORT = "12321"
    process.env.IPROYAL_USER = "demo-user"
    process.env.IPROYAL_PASS = "demo-pass_country-us"
    delete process.env.PROXY_HOST
    delete process.env.PROXY_PORT
    delete process.env.PROXY_USERNAME
    delete process.env.PROXY_PASSWORD

    const { buildProxyUrl } = await import("./config.js")
    expect(buildProxyUrl()).toBe(
      "http://demo-user:demo-pass_country-us@geo.iproyal.com:12321",
    )
  })

  it("falls back to PROXY_* env vars", async () => {
    delete process.env.IPROYAL_HOST
    delete process.env.IPROYAL_PORT
    delete process.env.IPROYAL_USER
    delete process.env.IPROYAL_PASS
    process.env.PROXY_HOST = "proxy.example.com"
    process.env.PROXY_PORT = "8080"
    process.env.PROXY_USERNAME = "legacy-user"
    process.env.PROXY_PASSWORD = "legacy-pass"

    const { buildProxyUrl, getPlaywrightProxy } = await import("./config.js")
    expect(buildProxyUrl()).toBe("http://legacy-user:legacy-pass@proxy.example.com:8080")
    expect(getPlaywrightProxy()).toEqual({
      server: "http://proxy.example.com:8080",
      username: "legacy-user",
      password: "legacy-pass",
    })
  })
})
