import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("notification cooldown", () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env.PROXY_HOST = "geo.iproyal.com"
    process.env.PROXY_PORT = "12321"
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...envBackup }
    vi.unstubAllGlobals()
  })

  it("allows the first claim and blocks duplicates within the cooldown window", async () => {
    const mod = await import("./notification-cooldown.js")
    mod.resetNotificationCooldownForTests()

    expect(await mod.claimNotificationCooldown("test-key", 60_000)).toBe(true)
    expect(await mod.claimNotificationCooldown("test-key", 60_000)).toBe(false)
  })
})

describe("notificationService", () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env.PROXY_HOST = "geo.iproyal.com"
    process.env.PROXY_PORT = "12321"
    process.env.ONESIGNAL_APP_ID = "app-123"
    process.env.ONESIGNAL_REST_API_KEY = "rest-key"
    process.env.NOTIFICATION_COOLDOWN_MS = "900000"
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...envBackup }
    vi.unstubAllGlobals()
  })

  it("posts OneSignal notifications filtered to pro and supreme tags", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "notification-1" }, { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { sendOneSignalQueueNotification } = await import("./notificationService.js")
    const id = await sendOneSignalQueueNotification({
      url: "https://www.pokemoncenter.com",
      status: 200,
    })

    expect(id).toBe("notification-1")
    expect(fetchMock).toHaveBeenCalledOnce()

    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const [url, init] = call as unknown as [string, RequestInit]
    expect(url).toBe("https://onesignal.com/api/v1/notifications")
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({
      Authorization: "Key rest-key",
    })

    const body = JSON.parse(String(init.body))
    expect(body.app_id).toBe("app-123")
    expect(body.priority).toBe(10)
    expect(body.url).toBe("https://www.pokemoncenter.com")
    expect(body.headings.en).toContain("Queue Live")
    expect(body.filters).toEqual([
      { field: "tag", key: "membership_tier", relation: "=", value: "pro" },
      { operator: "OR" },
      { field: "tag", key: "membership_tier", relation: "=", value: "supreme" },
    ])
  })

  it("enqueues async dispatch without awaiting network calls", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "notification-2" }, { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const service = await import("./notificationService.js")
    service.resetNotificationQueueForTests()
    const cooldown = await import("./notification-cooldown.js")
    cooldown.resetNotificationCooldownForTests()

    service.dispatchQueueNotificationAsync({
      url: "https://www.pokemoncenter.com",
      status: 200,
    })

    expect(service.getPendingNotificationCountForTests()).toBeGreaterThan(0)

    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(fetchMock).toHaveBeenCalled()
    expect(service.getPendingNotificationCountForTests()).toBe(0)
  })

  it("skips duplicate dispatches during the cooldown window", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "notification-3" }, { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const service = await import("./notificationService.js")
    service.resetNotificationQueueForTests()
    const cooldown = await import("./notification-cooldown.js")
    cooldown.resetNotificationCooldownForTests()

    const first = await service.sendQueueNotification({
      url: "https://www.pokemoncenter.com",
      status: 200,
    })
    const second = await service.sendQueueNotification({
      url: "https://www.pokemoncenter.com",
      status: 200,
    })

    expect(first.skipped).toBe(false)
    expect(second.skipped).toBe(true)
    expect(second.reason).toBe("cooldown_active")
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe("websocket broadcast", () => {
  it("broadcasts QUEUE_DETECTED payloads to connected clients", async () => {
    const { createServer } = await import("node:http")
    const { WebSocket } = await import("ws")
    const wsMod = await import("./websocket-broadcast.js")
    wsMod.resetWebSocketBroadcastForTests()

    const server = createServer((_req, res) => {
      res.writeHead(200)
      res.end("ok")
    })

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve())
    })

    wsMod.attachWebSocketBroadcast(server, "/ws")
    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("expected server address")
    }

    const client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`)
    const message = await new Promise<string>((resolve, reject) => {
      client.on("open", () => {
        wsMod.broadcastQueueDetected({
          url: "https://www.pokemoncenter.com",
          status: 200,
          detectedAt: "2025-07-21T13:30:00.000Z",
        })
      })
      client.on("message", (data) => resolve(String(data)))
      client.on("error", reject)
    })

    expect(JSON.parse(message)).toEqual({
      type: "QUEUE_DETECTED",
      url: "https://www.pokemoncenter.com",
      status: 200,
      detectedAt: "2025-07-21T13:30:00.000Z",
    })

    client.close()
    server.close()
    wsMod.resetWebSocketBroadcastForTests()
  })
})
