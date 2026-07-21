import { NextResponse } from "next/server"
import { parsePriceHistoryRange } from "@/lib/pricing/price-history-range"
import { loadScrydexPriceHistoryChart } from "@/lib/scrydex/history-loader"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"

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
  const { days } = parsePriceHistoryRange(rangeParam)

  try {
    const { catalogId, rows } = await loadScrydexPriceHistoryChart({
      scrydexId,
      game,
      days: days || 90,
    })

    if (searchParams.get("meta") === "1") {
      return NextResponse.json({
        scrydexId,
        catalogId,
        game,
        days: days || 90,
        count: rows.length,
        data: rows,
      })
    }

    return NextResponse.json(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load price history"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
