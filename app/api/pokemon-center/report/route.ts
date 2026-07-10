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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function processReport(
  request: Request,
  body: ReportBody,
): Promise<{ ok: true; discordSent: boolean; ntfySent: boolean; pushSent: boolean } | { ok: false; status: number; error: string }> {
  const proUserId = await resolveProUserId(request, body.token)
  if (!proUserId) {
    return { ok: false, status: 403, error: "Queue Watch requires a Pro subscription." }
  }

  const sessionId = body.sessionId?.trim()
  if (!sessionId || sessionId.length > 80) {
    return { ok: false, status: 400, error: "sessionId required" }
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
  const { discordSent, ntfySent, pushSent } = await maybeSendMobileAlerts(report, previous)
  return { ok: true, discordSent, ntfySent, pushSent }
}

/**
 * Navigation beacon for bookmarklets on CSP-locked sites (Pokemon Center).
 * connect-src blocks fetch to CollecTools, but window.open navigation still works.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  let signals: QueueSignal[] = []
  const rawSignals = url.searchParams.get("signals")
  if (rawSignals) {
    try {
      const parsed = JSON.parse(rawSignals) as unknown
      if (Array.isArray(parsed)) signals = parsed as QueueSignal[]
    } catch {
      signals = []
    }
  }

  const result = await processReport(request, {
    sessionId: url.searchParams.get("sessionId") ?? undefined,
    live: url.searchParams.get("live") === "1" || url.searchParams.get("live") === "true",
    confidence: Number(url.searchParams.get("confidence") || 0),
    signals,
    pageUrl: url.searchParams.get("pageUrl") ?? undefined,
    token: url.searchParams.get("token") ?? undefined,
    source: "bookmarklet",
  })

  if (!result.ok) {
    return new NextResponse(
      `<!doctype html><html><body style="font:14px system-ui;padding:16px">Queue Watch: ${result.error}<script>setTimeout(function(){window.close()},1500)</script></body></html>`,
      {
        status: result.status,
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
      },
    )
  }

  return new NextResponse(
    `<!doctype html><html><body style="font:14px system-ui;padding:16px;background:#111;color:#eee">PC Queue Watch ping OK<script>setTimeout(function(){window.close()},400)</script></body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
    },
  )
}

export async function POST(request: Request) {
  let body: ReportBody
  try {
    body = (await request.json()) as ReportBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS })
  }

  const result = await processReport(request, body)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, upgradeUrl: "/pricing" },
      { status: result.status, headers: CORS_HEADERS },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      discordSent: result.discordSent,
      ntfySent: result.ntfySent,
      pushSent: result.pushSent,
    },
    { headers: CORS_HEADERS },
  )
}
