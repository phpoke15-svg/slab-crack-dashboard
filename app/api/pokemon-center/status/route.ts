import { NextResponse } from "next/server"
import {
  BOOKMARKLET_STALE_MS,
  checkPokemonCenterQueue,
} from "@/lib/pokemon-center/queue-detector"
import {
  getLatestQueueWatchReportForUser,
  getQueueWatchReport,
  isQueueWatchReportsTableReady,
} from "@/lib/pokemon-center/queue-alerts"
import { requireQueueWatchAccess } from "@/lib/billing/stripe"
import { verifyQueueWatchToken } from "@/lib/billing/queue-watch-token"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

async function resolveProUserId(request: Request): Promise<string | null> {
  const url = new URL(request.url)
  const token =
    url.searchParams.get("token") ||
    request.headers.get("x-queue-watch-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    ""

  const fromToken = verifyQueueWatchToken(token)
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
  const proUserId = await resolveProUserId(request)
  if (!proUserId) {
    return NextResponse.json(
      { error: "PokeWatch requires a Pro subscription.", upgradeUrl: "/pricing" },
      { status: 403 },
    )
  }

  const url = new URL(request.url)
  const sessionId = url.searchParams.get("sessionId")?.trim()
  // Imperva blocks Vercel. Default: no outbound PC fetch.
  // ?probe=1 = soft cached probe (10–30 min TTL). Never used by the dashboard poller.
  const wantProbe = url.searchParams.get("probe") === "1"

  const bySession = sessionId ? await getQueueWatchReport(sessionId) : null
  const byUser =
    !isFreshReport(bySession?.reportedAt) ? await getLatestQueueWatchReportForUser(proUserId) : null

  const bookmarklet = isFreshReport(bySession?.reportedAt)
    ? bySession
    : isFreshReport(byUser?.reportedAt)
      ? byUser
      : bySession ?? byUser

  const bookmarkletFresh = isFreshReport(bookmarklet?.reportedAt)
  const reportsTableReady = await isQueueWatchReportsTableReady()

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

  let guidance: string | null = null
  if (!bookmarkletFresh) {
    if (!reportsTableReady) {
      guidance =
        "PokeWatch storage is missing. Run supabase/queue-watch.sql in the Supabase SQL editor, then re-copy the bookmarklet and click it on pokemoncenter.com."
    } else {
      guidance =
        "Start the bookmarklet on an open pokemoncenter.com tab (or click the orange badge once and allow the CollecTools pop-up). Server probes from Vercel are blocked by Imperva and are not used for LIVE detection."
    }
  }

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
    reportsTableReady,
    checkedAt: new Date().toISOString(),
    guidance,
  })
}
