import { NextResponse } from "next/server"
import { checkPokemonCenterQueue } from "@/lib/pokemon-center/queue-detector"
import { getQueueWatchReport } from "@/lib/pokemon-center/queue-alerts"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim()
  const bookmarklet = sessionId ? await getQueueWatchReport(sessionId) : null
  const server = await checkPokemonCenterQueue()

  const live = bookmarklet?.live ?? server.live
  const confidence = Math.max(bookmarklet?.confidence ?? 0, server.confidence)
  const source = bookmarklet?.live ? "bookmarklet" : server.live ? "server" : bookmarklet ? "bookmarklet" : "server"

  return NextResponse.json({
    live,
    confidence,
    source,
    server,
    bookmarklet,
    checkedAt: new Date().toISOString(),
  })
}
