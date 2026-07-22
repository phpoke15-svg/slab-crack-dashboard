import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http"
import { config } from "./config.js"
import { sendQueueLiveAlert, subscribeTokenToTopic } from "./fcm.js"
import {
  ensureStealthChromium,
  formatProbeError,
  formatProbeLogLine,
  probePokemonCenterQueue,
  type PokemonCenterProbeResult,
} from "./pokemon-center-probe.js"
import { logProxyIpDiagnostic, runProxyIpDiagnostic } from "./proxy-diagnostic.js"
import {
  canSendAlert,
  CHECK_COMPLETE_WAIT_MESSAGE,
  CHECK_INTERVAL_MS,
  createDebounceState,
  isWithinMonitoringWindow,
  markAlertSent,
  MONITORING_WINDOW_LABEL,
  OUTSIDE_MONITORING_WINDOW_MESSAGE,
  registerLiveHit,
  resetLiveDebounce,
  type LiveDebounceState,
} from "./queue-detector.js"
import { sendFailureAlert } from "./services/failure-alert.js"

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length === 0) return null
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

export function startSubscribeServer(): Server {
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

  return server
}

let probeInFlight = false
let consecutiveProbeFailures = 0

/** Alert after this many consecutive navigation/probe failures in a row. */
const CONSECUTIVE_FAILURE_ALERT_THRESHOLD = 2

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isNavigationFailure(probe: PokemonCenterProbeResult): boolean {
  return probe.navigationFailed === true
}

async function recordProbeOutcome(probe: PokemonCenterProbeResult): Promise<void> {
  if (isNavigationFailure(probe)) {
    consecutiveProbeFailures += 1
    if (consecutiveProbeFailures >= CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
      await sendFailureAlert(
        new Error(
          `${consecutiveProbeFailures} consecutive navigation failures (latest status=${probe.status})`,
        ),
        "consecutive_navigation_failures",
      )
    }
    return
  }

  consecutiveProbeFailures = 0
}

/** Single queue probe — only called while inside the monitoring window. */
export async function checkQueueOnce(debounce: LiveDebounceState): Promise<void> {
  if (probeInFlight) {
    console.log("[worker] Skipping scheduled check — previous probe still running")
    return
  }

  probeInFlight = true

  try {
    const probe = await probePokemonCenterQueue()
    console.log(formatProbeLogLine(probe))
    await recordProbeOutcome(probe)

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
    consecutiveProbeFailures += 1
    resetLiveDebounce(debounce)
    console.warn(`[worker] probe failed: ${formatProbeError(error)}`)
    await sendFailureAlert(error, "unexpected_probe_error")
  } finally {
    probeInFlight = false
  }
}

/** Poll loop: run checks every 90s inside the window; wait 90s between cycles outside it. */
export async function runQueueLoop(debounce: LiveDebounceState): Promise<never> {
  while (true) {
    try {
      if (!isWithinMonitoringWindow()) {
        console.log(OUTSIDE_MONITORING_WINDOW_MESSAGE)
        await sleep(CHECK_INTERVAL_MS)
        continue
      }

      await checkQueueOnce(debounce)
      console.log(CHECK_COMPLETE_WAIT_MESSAGE)
      await sleep(CHECK_INTERVAL_MS)
    } catch (error) {
      console.error(`[worker] Unexpected loop error: ${formatProbeError(error)}`)
      await sendFailureAlert(error, "run_queue_loop")
      await sleep(CHECK_INTERVAL_MS)
    }
  }
}

export function startQueueLoop(debounce: LiveDebounceState = createDebounceState()): void {
  void runQueueLoop(debounce)
}

export function resetProbeFailureStateForTests(): void {
  consecutiveProbeFailures = 0
  probeInFlight = false
}

async function main(): Promise<void> {
  ensureStealthChromium()
  console.log("[worker] Pokémon Center queue detector started")
  console.log("[worker] Queue probe transport=playwright-stealth profile=chromium-desktop-stealth")
  console.log(
    `[worker] Queue checks scheduled ${MONITORING_WINDOW_LABEL} every ${CHECK_INTERVAL_MS / 1000}s`,
  )
  console.log("[worker] Outside operating window — checks skipped until the next interval")
  console.log(`[worker] target=${config.targetUrl}`)

  startSubscribeServer()

  try {
    const proxyDiagnostic = await runProxyIpDiagnostic()
    logProxyIpDiagnostic(proxyDiagnostic)
  } catch (error) {
    console.warn(`[worker] Proxy diagnostic failed: ${formatProbeError(error)}`)
    await sendFailureAlert(error, "proxy_diagnostic")
  }

  await runQueueLoop(createDebounceState())
}

const isMain = Boolean(
  process.argv[1] &&
    import.meta.url === new URL(`file://${process.argv[1]}`).href,
)

if (isMain) {
  main().catch(async (error) => {
    console.error("[worker] fatal:", error)
    try {
      await sendFailureAlert(error, "fatal_startup")
    } catch {
      // best-effort alert before exit
    }
    process.exit(1)
  })
}
