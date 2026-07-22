import Fastify from "fastify"
import { subscribeTokenToTopic } from "./fcm.js"
import { config } from "./config.js"
import { handleTestQueueLive } from "./routes/test-queue-live.js"
import { handleQueueAlertWebhook } from "./routes/queue-alert-webhook.js"
import {
  attachWebSocketBroadcast,
  getWebSocketClientCount,
} from "./services/websocket-broadcast.js"

export async function createWorkerServer() {
  const app = Fastify({
    logger: false,
  })

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*")
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Webhook-Secret")
  })

  app.options("*", async (_request, reply) => {
    await reply.code(204).send()
  })

  app.get("/health", async (_request, reply) => {
    await reply.send({
      ok: true,
      service: "pokemon-center-queue-worker",
      mode: config.workerMode,
      websocketClients: getWebSocketClientCount(),
      oneSignalConfigured: Boolean(config.onesignalAppId && config.onesignalRestApiKey),
      notificationCooldownMs: config.notificationCooldownMs,
      webhookConfigured: Boolean(config.webhookSecret),
      testEndpointConfigured: Boolean(config.workerTestSecret),
    })
  })

  app.post("/api/webhook/queue-alert", handleQueueAlertWebhook)

  app.post("/test/queue-live", async (request, reply) => {
    reply.hijack()
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`)
    await handleTestQueueLive(request.raw, reply.raw, url)
  })

  app.post("/subscribe", async (request, reply) => {
    const body = request.body as { token?: string } | undefined
    const token = body?.token?.trim()
    if (!token) {
      await reply.code(400).send({ error: "token required" })
      return
    }

    try {
      await subscribeTokenToTopic(token)
      await reply.send({ ok: true, topic: config.fcmTopic })
    } catch (error) {
      const message = error instanceof Error ? error.message : "subscribe failed"
      console.error("[worker/subscribe]", message, error)
      await reply.code(500).send({ error: message })
    }
  })

  await app.ready()
  attachWebSocketBroadcast(app.server, "/ws")

  return app
}

export async function startWorkerServer(): Promise<ReturnType<typeof createWorkerServer>> {
  const app = await createWorkerServer()

  await app.listen({
    port: config.port,
    host: "0.0.0.0",
  })

  console.log(`[worker] HTTP server listening on 0.0.0.0:${config.port}`)
  console.log(`[worker] Queue alert webhook POST /api/webhook/queue-alert`)
  console.log(`[worker] FCM subscribe API POST /subscribe`)
  console.log(`[worker] WebSocket broadcast ws://0.0.0.0:${config.port}/ws`)
  if (config.workerTestSecret) {
    console.log(`[worker] Test endpoint POST /test/queue-live (?force=1 skips cooldown)`)
  }

  return app
}
