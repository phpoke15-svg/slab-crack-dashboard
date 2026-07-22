import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("failure-alert", () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env.PROXY_HOST = "geo.iproyal.com"
    process.env.PROXY_PORT = "12321"
    process.env.ONESIGNAL_APP_ID = "app-123"
    process.env.ONESIGNAL_REST_API_KEY = "rest-key"
    process.env.FAILURE_ALERT_COOLDOWN_MS = "3600000"
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...envBackup }
    vi.unstubAllGlobals()
  })

  it("sends OneSignal alerts to admin and supreme tags", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "fail-1" }, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const cooldown = await import("./notification-cooldown.js")
    cooldown.resetCooldownForTests()
    const { sendFailureAlert } = await import("./failure-alert.js")

    const result = await sendFailureAlert(new Error("page.goto timeout"), "unexpected_probe_error")

    expect(result.sent).toBe(true)
    expect(result.oneSignalId).toBe("fail-1")
    expect(fetchMock).toHaveBeenCalledOnce()

    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.filters).toEqual([
      { field: "tag", key: "role", relation: "=", value: "admin" },
      { operator: "OR" },
      { field: "tag", key: "membership_tier", relation: "=", value: "supreme" },
    ])
    expect(body.headings.en).toContain("Worker Failure")
    expect(body.contents.en).toContain("unexpected_probe_error")
    expect(body.contents.en).toContain("page.goto timeout")
  })

  it("rate-limits failure alerts to once per cooldown window", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "fail-2" }, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const cooldown = await import("./notification-cooldown.js")
    cooldown.resetCooldownForTests()
    const { sendFailureAlert } = await import("./failure-alert.js")

    const first = await sendFailureAlert(new Error("first failure"))
    const second = await sendFailureAlert(new Error("second failure"))

    expect(first.sent).toBe(true)
    expect(second.sent).toBe(false)
    expect(second.reason).toBe("cooldown_active")
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe("notification cooldown", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("allows the first claim and blocks duplicates within the cooldown window", async () => {
    const mod = await import("./notification-cooldown.js")
    mod.resetCooldownForTests()

    expect(mod.claimCooldown("test-key", 60_000)).toBe(true)
    expect(mod.claimCooldown("test-key", 60_000)).toBe(false)
  })
})
