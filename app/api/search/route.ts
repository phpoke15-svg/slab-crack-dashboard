import { NextRequest, NextResponse } from "next/server"
import {
  catalogHitToCardSearchHit,
  getCatalogCardCount,
  searchCatalogCardsLocal,
} from "@/lib/db/cards-catalog"
import { CATALOG_NOT_SEEDED_MESSAGE } from "@/lib/trade-binder/setup-health"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 24), 80)

  if (q.length < 2) {
    return NextResponse.json({ results: [], catalogReady: false })
  }

  const catalogReady = (await getCatalogCardCount()) > 0
  if (!catalogReady) {
    return NextResponse.json(
      { results: [], catalogReady: false, error: CATALOG_NOT_SEEDED_MESSAGE },
      { status: 503 },
    )
  }

  try {
    const hits = await searchCatalogCardsLocal(q, limit)
    const results = hits.map(catalogHitToCardSearchHit)
    return NextResponse.json(
      { results, catalogReady: true },
      { headers: { "Cache-Control": "private, max-age=60" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ results: [], catalogReady: true, error: message }, { status: 500 })
  }
}
