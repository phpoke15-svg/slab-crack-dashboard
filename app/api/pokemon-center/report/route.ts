import { NextResponse } from "next/server"
import {
  getQueueWatchReport,
  maybeSendMobileAlerts,
  saveQueueWatchReport,
  type QueueWatchReport,
} from "@/lib/pokemon-center/queue-alerts"
import type { QueueSignal } from "@/lib/pokemon-center/queue-detector"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

type ReportBody = {
  sessionId?: string
  live?: boolean
  confidence?: number
  signals?: QueueSignal[]
  pageUrl?: string
  ntfyTopic?: string
  source?: QueueWatchReport["source"]
}

export async function POST(request: Request) {
  let body: ReportBody
  try {
    body = (await request.json()) as ReportBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS })
  }

  const sessionId = body.sessionId?.trim()
  if (!sessionId || sessionId.length > 80) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400, headers: CORS_HEADERS })
  }

  const previous = await getQueueWatchReport(sessionId)
  const report: QueueWatchReport = {
    sessionId,
    live: Boolean(body.live),
    confidence: typeof body.confidence === "number" ? body.confidence : body.live ? 100 : 0,
    signals: Array.isArray(body.signals) ? body.signals : [],
    source: body.source ?? "bookmarklet",
    pageUrl: body.pageUrl,
    ntfyTopic: body.ntfyTopic?.trim(),
    reportedAt: new Date().toISOString(),
  }

  await saveQueueWatchReport(report)

  const { discordSent, ntfySent } = await maybeSendMobileAlerts(report, previous)

  return NextResponse.json({ ok: true, discordSent, ntfySent }, { headers: CORS_HEADERS })
}
