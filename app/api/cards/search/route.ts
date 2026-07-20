import { NextResponse } from "next/server"
import {
  catalogHitToCardSearchHit,
  getCatalogCardCount,
} from "@/lib/db/cards-catalog"
import { catalogSearchMinLength } from "@/lib/db/catalog-search-local"
import type { CardSearchHit } from "@/lib/card-lookup"
import { enrichCardSearchHitsWithPrices, SEARCH_SERVER_LIVE_PRICE_LIMIT } from "@/lib/pricing/persist-search-prices"
import { CATALOG_NOT_SEEDED_MESSAGE } from "@/lib/trade-binder/setup-health"
import { enrichHitsWithTcgGoImages } from "@/lib/tcggo-api"
import { searchCatalogHybrid } from "@/lib/trade-binder/catalog-search"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const SEARCH_CACHE_TTL_MS = 30 * 1000
const SEARCH_LIMIT = 40
const searchCache = new Map<string, { results: CardSearchHit[]; expiresAt: number }>()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const catalogReady = (await getCatalogCardCount()) > 0

  if (!catalogSearchMinLength(q)) {
    return NextResponse.json({ results: [], catalogReady })
  }

  if (!catalogReady) {
    return NextResponse.json(
      { results: [], catalogReady: false, error: CATALOG_NOT_SEEDED_MESSAGE },
      { status: 503 },
    )
  }

  const cacheKey = q.toLowerCase()
  const cached = searchCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { results: cached.results, catalogReady: true },
      { headers: { "Cache-Control": "private, max-age=120" } },
    )
  }

  try {
    const { hits, source } = await searchCatalogHybrid(q, { limit: SEARCH_LIMIT })
    const mapped = hits.map(catalogHitToCardSearchHit)
    const priced = await enrichCardSearchHitsWithPrices(mapped, {
      liveLimit: SEARCH_SERVER_LIVE_PRICE_LIMIT,
      timeBudgetMs: 25_000,
    })
    const results = await enrichHitsWithTcgGoImages(priced)
    searchCache.set(cacheKey, { results, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS })
    return NextResponse.json(
      { results, catalogReady: true, catalogSource: source },
      { headers: { "Cache-Control": "private, max-age=120" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ error: message, results: [], catalogReady: true }, { status: 500 })
  }
}
