import { NextResponse } from "next/server"
import { checkPokemonCenterQueue } from "@/lib/pokemon-center/queue-detector"
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

export async function GET(request: Request) {
  const allowed = await hasProAccess(request)
  if (!allowed) {
    return NextResponse.json(
      { error: "Queue Watch requires a Pro subscription.", upgradeUrl: "/pricing" },
      { status: 403 },
    )
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim()
  const bookmarklet = sessionId ? await getQueueWatchReport(sessionId) : null
  const server = await checkPokemonCenterQueue()

  const live = bookmarklet?.live ?? server.live
  const confidence = Math.max(bookmarklet?.confidence ?? 0, server.confidence)
  const source = bookmarklet?.live
    ? "bookmarklet"
    : server.live
      ? "server"
      : bookmarklet
        ? "bookmarklet"
        : "server"

  return NextResponse.json({
    live,
    confidence,
    source,
    server,
    bookmarklet,
    checkedAt: new Date().toISOString(),
  })
}
