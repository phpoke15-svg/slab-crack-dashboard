import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import {
  getQueueWatchReport,
  maybeSendMobileAlerts,
  saveQueueWatchReport,
} from "@/lib/pokemon-center/queue-alerts"
import { probePokemonCenterQueueCanary } from "@/lib/pokemon-center/queue-canary"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const CANARY_SESSION_ID = "canary-cron"

/**
 * Lightweight queue canary for Vercel Cron (or any scheduler with CRON_SECRET).
 * GET /api/check-queue — probes Pokemon Center for queue redirects/headers, fires global push on live edge.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const previous = await getQueueWatchReport(CANARY_SESSION_ID)
  const probe = await probePokemonCenterQueueCanary()

  const report = {
    sessionId: CANARY_SESSION_ID,
    live: probe.live,
    confidence: probe.confidence,
    signals: probe.signals,
    source: "server" as const,
    pageUrl: probe.finalUrl ?? probe.redirectUrl,
    reportedAt: probe.checkedAt,
  }

  const saved = await saveQueueWatchReport(report)
  if (!saved.ok) {
    return NextResponse.json(
      { ok: false, error: saved.error, probe },
      { status: 503 },
    )
  }

  const { discordSent, pushSent, challengePushSent } = await maybeSendMobileAlerts(report, previous)

  return NextResponse.json({
    ok: true,
    live: probe.live,
    blocked: probe.blocked,
    statusCode: probe.statusCode,
    redirectUrl: probe.redirectUrl ?? null,
    probeProfile: probe.probeProfile,
    pushSent,
    challengePushSent,
    discordSent,
    edge: probe.live && !previous?.live,
    checkedAt: probe.checkedAt,
  })
}
