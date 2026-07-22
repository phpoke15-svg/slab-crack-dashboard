import { createServer, request as httpRequest, type Server } from "node:http"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

async function postJson(
  port: number,
  path: string,
  options?: { authorization?: string; body?: unknown },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = options?.body ? JSON.stringify(options.body) : undefined

  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          ...(options?.authorization
            ? { Authorization: options.authorization }
            : {}),
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk) => chunks.push(chunk))
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8")
          resolve({
            status: res.statusCode ?? 0,
            body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
          })
        })
      },
    )
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
}

describe("POST /test/queue-live", () => {
  const envBackup = { ...process.env }
  let server: Server | null = null

  beforeEach(() => {
    process.env.PROXY_HOST = "geo.iproyal.com"
    process.env.PROXY_PORT = "12321"
    process.env.WORKER_TEST_SECRET = "test-secret"
    process.env.ONESIGNAL_APP_ID = "app-123"
    process.env.ONESIGNAL_REST_API_KEY = "rest-key"
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    vi.resetModules()
  })

  afterEach(async () => {
    process.env = { ...envBackup }
    vi.unstubAllGlobals()
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()))
      server = null
    }
  })

  async function startTestServer(): Promise<number> {
    const { handleTestQueueLive } = await import("./test-queue-live.js")
    server = createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1")
      if (request.method === "POST" && url.pathname === "/test/queue-live") {
        await handleTestQueueLive(request, response, url)
        return
      }
      response.writeHead(404)
      response.end()
    })

    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("expected server address")
    }
    return address.port
  }

  it("rejects requests without the bearer token", async () => {
    const port = await startTestServer()
    const response = await postJson(port, "/test/queue-live")
    expect(response.status).toBe(401)
  })

  it("dispatches a test notification and honors force=1 cooldown bypass", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "notification-test" }, { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const port = await startTestServer()

    const first = await postJson(port, "/test/queue-live", {
      authorization: "Bearer test-secret",
      body: { status: 302 },
    })
    expect(first.status).toBe(200)
    expect(first.body.ok).toBe(true)
    expect(first.body.skipped).toBe(false)

    const second = await postJson(port, "/test/queue-live", {
      authorization: "Bearer test-secret",
    })
    expect(second.status).toBe(200)
    expect(second.body.skipped).toBe(true)
    expect(second.body.reason).toBe("cooldown_active")

    const forced = await postJson(port, "/test/queue-live?force=1", {
      authorization: "Bearer test-secret",
    })
    expect(forced.status).toBe(200)
    expect(forced.body.skipped).toBe(false)
    expect(forced.body.force).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
