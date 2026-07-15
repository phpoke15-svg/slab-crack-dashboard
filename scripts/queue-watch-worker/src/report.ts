import { hasImpervaChallengeSignals } from "../../../lib/pokemon-center/queue-detector.js"
import type { QueueSignal } from "../../../lib/pokemon-center/queue-detector.js"

export type WorkerScanState = {
  live: boolean
  challenge: boolean
  confidence: number
  signals: QueueSignal[]
  blocked: boolean
  pageUrl: string
  checkedAt: string
}

export async function postReport(
  config: { collectoolsUrl: string; workerSecret: string; sessionId: string },
  state: WorkerScanState,
): Promise<{ ok: boolean; body?: unknown; status: number }> {
  const response = await fetch(`${config.collectoolsUrl}/api/pokemon-center/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.workerSecret}`,
    },
    body: JSON.stringify({
      sessionId: config.sessionId,
      live: state.live,
      confidence: state.confidence,
      signals: state.signals,
      pageUrl: state.pageUrl,
      source: "server",
    }),
  })

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // ignore
  }

  return { ok: response.ok, body, status: response.status }
}

export function shouldReportEdge(
  state: WorkerScanState,
  previous: WorkerScanState | null,
): boolean {
  const challenge = state.challenge || hasImpervaChallengeSignals(state.signals)
  const prevChallenge =
    previous != null &&
    (previous.challenge || hasImpervaChallengeSignals(previous.signals))
  const liveEdge = state.live && !previous?.live
  const challengeEdge = challenge && !prevChallenge
  return liveEdge || challengeEdge
}
