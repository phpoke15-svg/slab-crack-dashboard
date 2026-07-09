import { NextResponse } from "next/server"
import {
  getQueueWatchReport,
  maybeSendMobileAlerts,
  saveQueueWatchReport,
  type QueueWatchReport,
} from "@/lib/pokemon-center/queue-alerts"
import type { QueueSignal } from "@/lib/pokemon-center/queue-detector"
import { requireQueueWatchAccess } from "@/lib/billing/stripe"
import { verifyQueueWatchToken } from "@/lib/billing/queue-watch-token"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Queue-Watch-Token",
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
  token?: string
}

async function resolveProUserId(request: Request, bodyToken?: string): Promise<string | null> {
  const headerToken =
    request.headers.get("x-queue-watch-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    bodyToken
  const fromToken = verifyQueueWatchToken(headerToken)
  if (fromToken) {
    const allowed = await requireQueueWatchAccess(fromToken)
    return allowed ? fromToken : null
  }

  try {
    const auth = await requireUser()
    if (auth.ok) {
      const allowed = await requireQueueWatchAccess(auth.user.id)
      return allowed ? auth.user.id : null
    }
  } catch {
    // unauthenticated
  }
  return null
}

export async function POST(request: Request) {
  let body: ReportBody
  try {
    body = (await request.json()) as ReportBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS })
  }

  const proUserId = await resolveProUserId(request, body.token)
  if (!proUserId) {
    return NextResponse.json(
      { error: "Queue Watch requires a Pro subscription.", upgradeUrl: "/pricing" },
      { status: 403, headers: CORS_HEADERS },
    )
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
