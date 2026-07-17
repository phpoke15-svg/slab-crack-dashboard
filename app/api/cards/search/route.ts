import { NextResponse } from "next/server"
import { searchCatalogCards, type CardSearchHit } from "@/lib/card-lookup"
import {
  catalogHitToCardSearchHit,
  getCatalogCardCount,
  searchCatalogCardsLocal,
} from "@/lib/db/cards-catalog"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000
const SEARCH_LIMIT = 24
const searchCache = new Map<string, { results: CardSearchHit[]; expiresAt: number }>()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const cacheKey = q.toLowerCase()
  const cached = searchCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { results: cached.results },
      { headers: { "Cache-Control": "private, max-age=120" } },
    )
  }

  try {
    const catalogReady = (await getCatalogCardCount()) > 0
    let results: CardSearchHit[]

    if (catalogReady) {
      const hits = await searchCatalogCardsLocal(q, SEARCH_LIMIT)
      results = hits.map(catalogHitToCardSearchHit)
    } else {
      results = await searchCatalogCards(q, SEARCH_LIMIT, 12_000)
    }

    searchCache.set(cacheKey, { results, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS })
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "private, max-age=120" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ error: message, results: [] }, { status: 500 })
  }
}
