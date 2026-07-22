import { NextResponse } from "next/server"
import { parsePriceHistoryRange } from "@/lib/pricing/price-history-range"
import { loadScrydexPriceHistoryChart } from "@/lib/scrydex/history-loader"
import { parsePriceHistoryType } from "@/lib/scrydex/price-history-type"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"

/** Reads/writes `public.price_history_daily` (Scrydex daily snapshots keyed by catalog_id). */

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(
  request: Request,
  context: { params: Promise<{ scrydex_id: string }> },
) {
  const { scrydex_id: scrydexIdRaw } = await context.params
  const scrydexId = decodeURIComponent(scrydexIdRaw).trim()

  if (!scrydexId) {
    return NextResponse.json({ error: "scrydex_id is required" }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const game = parseTcgResearchGame(searchParams.get("game"))
  const rangeParam = searchParams.get("range") ?? searchParams.get("days")
  const { days, full, key: rangeKey } = parsePriceHistoryRange(rangeParam)
  const historyDays = full ? 0 : (days || 90)
  const type = parsePriceHistoryType(searchParams.get("type"))
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const interval = searchParams.get("interval") ?? "daily"

  try {
    const result = await loadScrydexPriceHistoryChart({
      scrydexId,
      game,
      days: historyDays,
      full,
      from,
      to,
      interval,
      type,
    })

    if (searchParams.get("meta") === "1") {
      return NextResponse.json({
        scrydexId,
        catalogId: result.catalogId,
        game,
        range: rangeKey,
        days: historyDays,
        type,
        from: from ?? undefined,
        to: to ?? undefined,
        interval,
        count: result.rows.length,
        source: result.source,
        backfilled: result.backfilled,
        rateLimited: result.rateLimited,
        data: result.rows,
      })
    }

    return NextResponse.json(result.rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load price history"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
