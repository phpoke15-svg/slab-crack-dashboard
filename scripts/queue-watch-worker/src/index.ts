import { isPokeWatchDropWindow } from "../../../lib/pokemon-center/drop-window.js"
import { hasImpervaChallengeSignals } from "../../../lib/pokemon-center/queue-detector.js"
import { ensureMonitorPage, openMonitorContext, readMonitorState, refreshMonitorPage } from "./browser.js"
import { loadConfig } from "./config.js"
import { postReport, shouldReportEdge, type WorkerScanState } from "./report.js"

function log(message: string, extra?: Record<string, unknown>) {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : ""
  console.log(`[${new Date().toISOString()}] ${message}${suffix}`)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const config = loadConfig()
  log("PokeWatch worker starting", {
    sessionId: config.sessionId,
    profileDir: config.profileDir,
    pollMs: config.pollMs,
    proxy: config.proxyServer || "none",
  })

  const context = await openMonitorContext({
    profileDir: config.profileDir,
    proxyServer: config.proxyServer || undefined,
  })

  let page = await ensureMonitorPage(context)
  let previous: WorkerScanState | null = null
  let blindPolls = 0

  while (true) {
    const inWindow = config.forceWindow || isPokeWatchDropWindow()
    if (!inWindow) {
      log("Outside Mon–Fri 10am–3pm ET window — sleeping 60s")
      await sleep(60_000)
      continue
    }

    try {
      if (page.isClosed()) {
        page = await ensureMonitorPage(context)
      }

      const state = await readMonitorState(page)
      if (!state) {
        log("Could not read monitor state — reloading")
        await refreshMonitorPage(page)
        await sleep(config.pollMs)
        continue
      }

      const challenge = state.challenge || hasImpervaChallengeSignals(state.signals)
      const blocked = state.blocked && !challenge && !state.live

      if (blocked) blindPolls += 1
      else blindPolls = 0

      log("scan", {
        live: state.live,
        challenge,
        confidence: state.confidence,
        url: state.pageUrl,
        signals: state.signals.map((s) => s.id),
      })

      if (shouldReportEdge({ ...state, challenge }, previous)) {
        const result = await postReport(config, { ...state, challenge })
        log("report", { ok: result.ok, status: result.status, body: result.body })
        previous = { ...state, challenge }
      }

      if (blindPolls >= 40) {
        log("WARN: 40+ blocked polls in a row — rebootstrap cookies or enable PROXY_SERVER")
        blindPolls = 0
      }

      await sleep(config.pollMs)
      await refreshMonitorPage(page)
    } catch (err) {
      log("error", { message: err instanceof Error ? err.message : String(err) })
      await sleep(Math.min(config.pollMs * 2, 60_000))
      try {
        page = await ensureMonitorPage(context)
      } catch {
        // retry outer loop
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
