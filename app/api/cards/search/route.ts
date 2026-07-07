import { NextResponse } from "next/server"
import { searchCatalogCards, type CardSearchHit } from "@/lib/card-lookup"

export const dynamic = "force-dynamic"

const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000
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
    const results = await searchCatalogCards(q, 12)
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
