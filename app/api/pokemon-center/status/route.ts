import { NextResponse } from "next/server"
import {
  BOOKMARKLET_STALE_MS,
  checkPokemonCenterQueue,
} from "@/lib/pokemon-center/queue-detector"
import { getQueueWatchReport } from "@/lib/pokemon-center/queue-alerts"
import { requireQueueWatchAccess } from "@/lib/billing/stripe"
import { verifyQueueWatchToken } from "@/lib/billing/queue-watch-token"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

async function hasProAccess(request: Request): Promise<boolean> {
  const url = new URL(request.url)
  const token =
    url.searchParams.get("token") ||
    request.headers.get("x-queue-watch-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    ""

  const fromToken = verifyQueueWatchToken(token)
  if (fromToken) return requireQueueWatchAccess(fromToken)

  try {
    const auth = await requireUser()
    if (auth.ok) return requireQueueWatchAccess(auth.user.id)
  } catch {
    // unauthenticated
  }
  return false
}

function isFreshReport(reportedAt: string | undefined): boolean {
  if (!reportedAt) return false
  const ts = Date.parse(reportedAt)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < BOOKMARKLET_STALE_MS
}

const SKIPPED_SERVER = {
  live: false,
  confidence: 0,
  signals: [
    {
      id: "probe-skipped",
      label: "Server probe skipped (bookmarklet-first)",
      confidence: 0,
    },
  ],
  blocked: false,
  checkedAt: new Date().toISOString(),
  cached: true,
}

export async function GET(request: Request) {
  const allowed = await hasProAccess(request)
  if (!allowed) {
    return NextResponse.json(
      { error: "Queue Watch requires a Pro subscription.", upgradeUrl: "/pricing" },
      { status: 403 },
    )
  }

  const url = new URL(request.url)
  const sessionId = url.searchParams.get("sessionId")?.trim()
  // Imperva blocks Vercel. Default: no outbound PC fetch.
  // ?probe=1 = soft cached probe (10–30 min TTL). Never used by the dashboard poller.
  const wantProbe = url.searchParams.get("probe") === "1"

  const bookmarklet = sessionId ? await getQueueWatchReport(sessionId) : null
  const bookmarkletFresh = isFreshReport(bookmarklet?.reportedAt)

  // When the user's tab is already reporting, never touch pokemoncenter.com from Vercel.
  const server =
    wantProbe && !bookmarkletFresh
      ? await checkPokemonCenterQueue()
      : { ...SKIPPED_SERVER, checkedAt: new Date().toISOString() }

  const live = bookmarkletFresh ? Boolean(bookmarklet?.live) : false
  const confidence = bookmarkletFresh ? (bookmarklet?.confidence ?? 0) : 0
  const source = bookmarkletFresh
    ? "bookmarklet"
    : server.blocked
      ? "blocked"
      : wantProbe
        ? "server"
        : "idle"

  return NextResponse.json({
    live,
    confidence,
    source,
    server,
    bookmarklet: bookmarklet
      ? {
          ...bookmarklet,
          fresh: bookmarkletFresh,
        }
      : null,
    checkedAt: new Date().toISOString(),
    guidance: bookmarkletFresh
      ? null
      : "Start the bookmarklet on an open pokemoncenter.com tab. Server probes from Vercel are blocked by Imperva and are not used for LIVE detection.",
  })
}
