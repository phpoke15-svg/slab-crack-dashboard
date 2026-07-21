import { NextResponse } from "next/server"
import {
  catalogHitToCardSearchHit,
  getCatalogCardCount,
} from "@/lib/db/cards-catalog"
import { catalogSearchMinLength, normalizeSearchCleanName } from "@/lib/db/catalog-search-local"
import type { CardSearchHit } from "@/lib/card-lookup"
import { getMemorySearchCache, setMemorySearchCache } from "@/lib/cache/search-memory-cache"
import {
  getSearchRedisCache,
  isSearchRedisConfigured,
  setSearchRedisCache,
} from "@/lib/cache/search-redis"
import { enrichCardSearchHitsWithPrices, SEARCH_SERVER_LIVE_PRICE_LIMIT } from "@/lib/pricing/persist-search-prices"
import { CATALOG_NOT_SEEDED_MESSAGE } from "@/lib/trade-binder/setup-health"
import { enrichHitsWithTcgGoImages } from "@/lib/tcggo-api"
import { searchCatalogHybrid } from "@/lib/trade-binder/catalog-search"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const SEARCH_CACHE_TTL_SECONDS = 30
const SEARCH_LIMIT = 40

async function readSearchCache(cacheKey: string): Promise<CardSearchHit[] | null> {
  const memoryHit = getMemorySearchCache(cacheKey)
  if (memoryHit) return memoryHit

  if (!isSearchRedisConfigured()) return null
  return getSearchRedisCache<CardSearchHit[]>(cacheKey)
}

async function writeSearchCache(cacheKey: string, results: CardSearchHit[]): Promise<void> {
  setMemorySearchCache(cacheKey, results)
  if (isSearchRedisConfigured()) {
    await setSearchRedisCache(cacheKey, results, SEARCH_CACHE_TTL_SECONDS)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawQuery = searchParams.get("q")?.trim() ?? ""
  const sqlQuery = normalizeSearchCleanName(rawQuery)
  const catalogReady = (await getCatalogCardCount()) > 0

  if (!catalogSearchMinLength(rawQuery)) {
    return NextResponse.json({ results: [], catalogReady })
  }

  if (!catalogReady) {
    return NextResponse.json(
      { results: [], catalogReady: false, error: CATALOG_NOT_SEEDED_MESSAGE },
      { status: 503 },
    )
  }

  const cacheKey = sqlQuery || rawQuery.toLowerCase()
  const cached = await readSearchCache(cacheKey)
  if (cached) {
    return NextResponse.json(
      { results: cached, catalogReady: true },
      { headers: { "Cache-Control": "private, max-age=120" } },
    )
  }

  try {
    const { hits, source } = await searchCatalogHybrid(rawQuery, {
      limit: SEARCH_LIMIT,
      sqlQuery,
    })
    const mapped = hits.map(catalogHitToCardSearchHit)
    const priced = await enrichCardSearchHitsWithPrices(mapped, {
      liveLimit: SEARCH_SERVER_LIVE_PRICE_LIMIT,
      timeBudgetMs: 25_000,
    })
    const results = await enrichHitsWithTcgGoImages(priced)
    await writeSearchCache(cacheKey, results)
    return NextResponse.json(
      { results, catalogReady: true, catalogSource: source },
      { headers: { "Cache-Control": "private, max-age=120" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ error: message, results: [], catalogReady: true }, { status: 500 })
  }
}
