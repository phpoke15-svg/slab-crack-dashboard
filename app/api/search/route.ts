import { NextRequest, NextResponse } from "next/server"
import {
  catalogHitToCardSearchHit,
  getCatalogCardCount,
} from "@/lib/db/cards-catalog"
import { catalogSearchMinLength } from "@/lib/db/catalog-search-local"
import { enrichCardSearchHitsWithPrices } from "@/lib/pricing/persist-search-prices"
import { CATALOG_NOT_SEEDED_MESSAGE } from "@/lib/trade-binder/setup-health"
import { searchCatalogHybrid } from "@/lib/trade-binder/catalog-search"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 24), 80)

  if (!catalogSearchMinLength(q)) {
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
    const { hits } = await searchCatalogHybrid(q, { limit })
    const mapped = hits.map(catalogHitToCardSearchHit)
    const results = await enrichCardSearchHitsWithPrices(mapped)
    return NextResponse.json(
      { results, catalogReady: true },
      { headers: { "Cache-Control": "private, max-age=60" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ results: [], catalogReady: true, error: message }, { status: 500 })
  }
}
