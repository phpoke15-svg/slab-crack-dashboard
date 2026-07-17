import { NextResponse } from "next/server"
import {
  catalogHitToCardSearchHit,
  getCatalogCardCount,
  searchCatalogCardsLocal,
} from "@/lib/db/cards-catalog"
import type { CardSearchHit } from "@/lib/card-lookup"
import { CATALOG_NOT_SEEDED_MESSAGE } from "@/lib/trade-binder/setup-health"

export const dynamic = "force-dynamic"
export const maxDuration = 15

const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000
const SEARCH_LIMIT = 40
const searchCache = new Map<string, { results: CardSearchHit[]; expiresAt: number }>()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  if (q.length < 2) {
    return NextResponse.json({ results: [], catalogReady: (await getCatalogCardCount()) > 0 })
  }

  const catalogReady = (await getCatalogCardCount()) > 0
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
    const hits = await searchCatalogCardsLocal(q, SEARCH_LIMIT)
    const results = hits.map(catalogHitToCardSearchHit)
    searchCache.set(cacheKey, { results, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS })
    return NextResponse.json(
      { results, catalogReady: true },
      { headers: { "Cache-Control": "private, max-age=120" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ error: message, results: [], catalogReady: true }, { status: 500 })
  }
}
