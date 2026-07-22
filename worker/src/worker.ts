import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { fileURLToPath } from "node:url"
import cron from "node-cron"
import { config } from "./config.js"
import { sendQueueLiveAlert, subscribeTokenToTopic } from "./fcm.js"
import {
  ensureStealthChromium,
  formatProbeError,
  formatProbeLogLine,
  probePokemonCenterQueue,
} from "./pokemon-center-probe.js"
import { logProxyIpDiagnostic, runProxyIpDiagnostic } from "./proxy-diagnostic.js"
import {
  canSendAlert,
  createDebounceState,
  CRON_SCHEDULE,
  CRON_TIMEZONE,
  isWithinMonitoringWindow,
  markAlertSent,
  MONITORING_WINDOW_LABEL,
  OUTSIDE_MONITORING_WINDOW_MESSAGE,
  registerLiveHit,
  resetLiveDebounce,
  type LiveDebounceState,
} from "./queue-detector.js"

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length === 0) return null
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

export function startSubscribeServer(): void {
  const server = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*")
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    response.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (request.method === "OPTIONS") {
      response.writeHead(204)
      response.end()
      return
    }

    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "Content-Type": "application/json" })
      response.end(JSON.stringify({ ok: true, service: "pokemon-center-queue-worker" }))
      return
    }

    if (request.method !== "POST" || request.url !== "/subscribe") {
      response.writeHead(404, { "Content-Type": "application/json" })
      response.end(JSON.stringify({ error: "Not found" }))
      return
    }

    try {
      const body = (await readJsonBody(request)) as { token?: string } | null
      const token = body?.token?.trim()
      if (!token) {
        response.writeHead(400, { "Content-Type": "application/json" })
        response.end(JSON.stringify({ error: "token required" }))
        return
      }

      await subscribeTokenToTopic(token)
      response.writeHead(200, { "Content-Type": "application/json" })
      response.end(JSON.stringify({ ok: true, topic: config.fcmTopic }))
    } catch (error) {
      const message = error instanceof Error ? error.message : "subscribe failed"
      console.error("[worker/subscribe]", message)
      response.writeHead(500, { "Content-Type": "application/json" })
      response.end(JSON.stringify({ error: message }))
    }
  })

  server.listen(config.subscribePort, "0.0.0.0", () => {
    console.log(`[worker] FCM subscribe API listening on 0.0.0.0:${config.subscribePort}/subscribe`)
  })
}

let probeInFlight = false

/** Single queue probe — invoked on the weekday cron schedule (window guarded in code). */
export async function checkQueueOnce(debounce: LiveDebounceState): Promise<void> {
  if (!isWithinMonitoringWindow()) {
    console.log(OUTSIDE_MONITORING_WINDOW_MESSAGE)
    return
  }

  if (probeInFlight) {
    console.log("[worker] Skipping scheduled check — previous probe still running")
    return
  }

  probeInFlight = true

  try {
    const probe = await probePokemonCenterQueue()
    console.log(formatProbeLogLine(probe))

    if (probe.live) {
      const confirmed = registerLiveHit(debounce)
      if (confirmed && canSendAlert(debounce)) {
        const queueUrl = probe.queueUrl ?? config.queueDeepLink
        const messageId = await sendQueueLiveAlert(queueUrl)
        markAlertSent(debounce)
        console.log(`[worker] FCM alert sent (${messageId}) topic=${config.fcmTopic} url=${queueUrl}`)
      }
    } else {
      resetLiveDebounce(debounce)
    }
  } catch (error) {
    resetLiveDebounce(debounce)
    console.warn(`[worker] probe failed: ${formatProbeError(error)}`)
  } finally {
    probeInFlight = false
  }
}

export function startQueueSchedule(debounce: LiveDebounceState = createDebounceState()): void {
  cron.schedule(
    CRON_SCHEDULE,
    () => {
      void checkQueueOnce(debounce)
    },
    { timezone: CRON_TIMEZONE },
  )
}

async function main(): Promise<void> {
  ensureStealthChromium()
  console.log("[worker] Pokémon Center queue detector started")
  console.log("[worker] Queue probe transport=playwright-stealth profile=chromium-desktop-stealth")
  console.log(
    `[worker] Queue checks scheduled ${MONITORING_WINDOW_LABEL} every 3 minutes (cron: ${CRON_SCHEDULE})`,
  )
  console.log("[worker] Outside operating window — checks skipped until the next interval")
  console.log(`[worker] target=${config.targetUrl}`)

  startSubscribeServer()

  const proxyDiagnostic = await runProxyIpDiagnostic()
  logProxyIpDiagnostic(proxyDiagnostic)

  startQueueSchedule()

  await new Promise<void>(() => {
    // Keep process alive; cron handles all queue probes.
  })
}

const isMain = Boolean(
  process.argv[1] &&
    import.meta.url === new URL(`file://${process.argv[1]}`).href,
)

if (isMain) {
  main().catch((error) => {
    console.error("[worker] fatal:", error)
    process.exit(1)
  })
}
