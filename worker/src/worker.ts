import { config, assertProxyConfigured } from "./config.js"
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
import { dispatchQueueNotificationAsync } from "./services/notificationService.js"
import { startWorkerServer } from "./server.js"

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
        dispatchQueueNotificationAsync({
          url: queueUrl,
          status: probe.status,
        })
        markAlertSent(debounce)
        console.log(`[worker] Queue alert queued for async dispatch url=${queueUrl}`)
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

async function startLegacyProbeLoop(): Promise<void> {
  assertProxyConfigured()
  ensureStealthChromium()
  console.log("[worker] Legacy probe mode enabled (WORKER_MODE=probe)")
  console.log("[worker] Queue probe transport=playwright-stealth profile=chromium-desktop-stealth")
  console.log(
    `[worker] Queue checks scheduled ${MONITORING_WINDOW_LABEL} every ${CHECK_INTERVAL_MS / 1000}s`,
  )
  console.log(`[worker] target=${config.targetUrl}`)

  try {
    const proxyDiagnostic = await runProxyIpDiagnostic()
    logProxyIpDiagnostic(proxyDiagnostic)
  } catch (error) {
    console.warn(`[worker] Proxy diagnostic failed: ${formatProbeError(error)}`)
    await sendFailureAlert(error, "proxy_diagnostic")
  }

  startQueueLoop(createDebounceState())
}

async function main(): Promise<void> {
  console.log("[worker] Pokémon Center alert worker started")
  console.log(`[worker] mode=${config.workerMode}`)

  await startWorkerServer()

  if (config.workerMode === "probe") {
    await startLegacyProbeLoop()
  } else {
    console.log("[worker] Inbound webhook receiver ready — POST /api/webhook/queue-alert")
  }
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
