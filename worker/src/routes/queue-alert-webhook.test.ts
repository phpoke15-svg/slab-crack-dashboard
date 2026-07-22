import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("queue-alert webhook", () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env.WEBHOOK_SECRET = "hook-secret"
    process.env.NOTIFICATION_COOLDOWN_MS = "900000"
    process.env.ONESIGNAL_APP_ID = "app-123"
    process.env.ONESIGNAL_REST_API_KEY = "rest-key"
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...envBackup }
    vi.unstubAllGlobals()
  })

  it("parses drop details from webhook payload", async () => {
    const { parseQueueAlertPayload } = await import("./queue-alert-webhook.js")
    const { config } = await import("../config.js")

    const details = parseQueueAlertPayload({
      siteTitle: "Pokémon Center",
      dropUrl: "https://www.pokemoncenter.com/queue",
      productName: "151 Booster Bundle",
      status: 302,
    })

    expect(details).toMatchObject({
      url: "https://www.pokemoncenter.com/queue",
      siteTitle: "Pokémon Center",
      productName: "151 Booster Bundle",
      status: 302,
    })
    expect(details?.detectedAt).toBeTruthy()
    expect(config.notificationCooldownMs).toBe(900_000)
  })

  it("rejects unauthorized webhook requests", async () => {
    const { isWebhookAuthorized } = await import("./queue-alert-webhook.js")
    const request = {
      headers: {},
      query: {},
    } as unknown as Parameters<typeof isWebhookAuthorized>[0]

    expect(isWebhookAuthorized(request)).toBe(false)
  })

  it("accepts webhook secret via X-Webhook-Secret header", async () => {
    const { isWebhookAuthorized } = await import("./queue-alert-webhook.js")
    const request = {
      headers: { "x-webhook-secret": "hook-secret" },
      query: {},
    } as unknown as Parameters<typeof isWebhookAuthorized>[0]

    expect(isWebhookAuthorized(request)).toBe(true)
  })

  it("returns 200 immediately and dispatches notifications asynchronously", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "notification-webhook" }, { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { handleQueueAlertWebhook } = await import("./queue-alert-webhook.js")

    const sent: unknown[] = []
    const reply = {
      code(statusCode: number) {
        this.statusCode = statusCode
        return this
      },
      async send(payload: unknown) {
        sent.push({ statusCode: this.statusCode, payload })
      },
      statusCode: 200,
    }

    const request = {
      headers: { authorization: "Bearer hook-secret" },
      query: {},
      body: {
        siteTitle: "Pokémon Center",
        dropUrl: "https://www.pokemoncenter.com/live",
        productName: "Prismatic Evolutions ETB",
      },
    } as unknown as Parameters<typeof handleQueueAlertWebhook>[0]

    await handleQueueAlertWebhook(request, reply as unknown as Parameters<typeof handleQueueAlertWebhook>[1])

    expect(sent[0]).toMatchObject({
      statusCode: 200,
      payload: {
        ok: true,
        accepted: true,
        url: "https://www.pokemoncenter.com/live",
      },
    })

    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
    expect(fetchMock).toHaveBeenCalledOnce()

    const { resetNotificationQueueForTests } = await import("../services/notificationService.js")
    resetNotificationQueueForTests()
  })

  it("deduplicates duplicate webhooks within the cooldown window", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "notification-webhook" }, { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { resetNotificationCooldownForTests } = await import("../services/notification-cooldown.js")
    resetNotificationCooldownForTests()

    const { handleQueueAlertWebhook } = await import("./queue-alert-webhook.js")

    const makeReply = () => {
      const reply = {
        code(statusCode: number) {
          this.statusCode = statusCode
          return this
        },
        async send(payload: unknown) {
          this.payload = payload
        },
        statusCode: 200,
        payload: undefined as unknown,
      }
      return reply
    }

    const request = {
      headers: { "x-webhook-secret": "hook-secret" },
      query: {},
      body: {
        dropUrl: "https://www.pokemoncenter.com/live",
      },
    } as unknown as Parameters<typeof handleQueueAlertWebhook>[0]

    const firstReply = makeReply()
    await handleQueueAlertWebhook(request, firstReply as unknown as Parameters<typeof handleQueueAlertWebhook>[1])
    expect(firstReply.statusCode).toBe(200)

    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    const secondReply = makeReply()
    await handleQueueAlertWebhook(request, secondReply as unknown as Parameters<typeof handleQueueAlertWebhook>[1])
    expect(secondReply.statusCode).toBe(200)

    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    expect(fetchMock).toHaveBeenCalledOnce()

    const { resetNotificationQueueForTests } = await import("../services/notificationService.js")
    resetNotificationQueueForTests()
  })
})
