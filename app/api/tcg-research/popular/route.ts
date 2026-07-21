import { NextResponse } from "next/server"
import { getPopularTcgResearchCards } from "@/lib/tcg-research/popular-cards"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"

export const dynamic = "force-dynamic"
export const revalidate = 300

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const game = parseTcgResearchGame(searchParams.get("game"))
  const limitRaw = Number(searchParams.get("limit") ?? TOP_CARDS_LIMIT)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), TOP_CARDS_LIMIT) : TOP_CARDS_LIMIT

  try {
    const results = await getPopularTcgResearchCards(game, limit)
    return NextResponse.json(
      { game, limit, count: results.length, results },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load popular cards"
    return NextResponse.json({ error: message, results: [] }, { status: 500 })
  }
}
