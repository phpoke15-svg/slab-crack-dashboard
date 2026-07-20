import { NextRequest, NextResponse } from "next/server"
import { getCatalogCardCount } from "@/lib/db/cards-catalog"
import {
  applySearchPricesToCards,
  enrichSearchCardPrices,
  SEARCH_SERVER_LIVE_PRICE_LIMIT,
} from "@/lib/pricing/persist-search-prices"
import { mergeBinderSearchResults, type BinderSearchResultCard } from "@/lib/trade-binder/binder-search"
import { searchBinderCatalog } from "@/lib/trade-binder/catalog-search"
import { fetchPopularBinderCards } from "@/lib/trade-binder/popular-binder-cards"
import { CATALOG_NOT_SEEDED_MESSAGE } from "@/lib/trade-binder/setup-health"

export const maxDuration = 60

function mapCatalogCardsToBinder(
  catalogCards: Awaited<ReturnType<typeof searchBinderCatalog>>,
): BinderSearchResultCard[] {
  return catalogCards.map((card) => ({
    id: card.id,
    name: card.name,
    set: card.set,
    rarity: card.rarity,
    image: card.image,
    cardNumber: card.cardNumber,
    rawPrice: card.rawPrice,
  }))
}

function catalogUnavailableResponse() {
  return NextResponse.json(
    {
      error: CATALOG_NOT_SEEDED_MESSAGE,
      catalogReady: false,
      cards: [],
      totalCount: 0,
    },
    { status: 503 },
  )
}

async function attachLiveSearchPrices(cards: BinderSearchResultCard[]): Promise<BinderSearchResultCard[]> {
  if (cards.length === 0) return cards

  const inputs = cards.map((card) => ({
    id: card.id,
    name: card.name,
    set: card.set,
    cardNumber: card.cardNumber,
    rawPrice: card.rawPrice,
  }))
  const prices = await enrichSearchCardPrices(inputs, {
    liveLimit: SEARCH_SERVER_LIVE_PRICE_LIMIT,
  })
  return applySearchPricesToCards(cards, prices)
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1), 1)
  const pageSize = Math.min(Number(request.nextUrl.searchParams.get("pageSize") ?? 40), 80)

  try {
    const catalogReady = (await getCatalogCardCount()) > 0
    if (!catalogReady) {
      return catalogUnavailableResponse()
    }

    if (q.length >= 2) {
      const catalogCards = await searchBinderCatalog(q, { limit: pageSize })
      const merged = mergeBinderSearchResults(mapCatalogCardsToBinder(catalogCards), q).slice(0, pageSize)
      const cards = await attachLiveSearchPrices(merged)

      return NextResponse.json({
        cards,
        totalCount: cards.length,
        page: 1,
        hasMore: false,
        languageFilter: "english",
        catalogSource: "local",
        catalogReady: true,
      })
    }

    if (page === 1) {
      const popular = await fetchPopularBinderCards(Math.min(pageSize, 30))
      const cards = await attachLiveSearchPrices(popular)
      return NextResponse.json({
        cards,
        totalCount: cards.length,
        page: 1,
        hasMore: false,
        featured: true,
        languageFilter: "english",
        catalogSource: "local",
        catalogReady: true,
      })
    }

    return NextResponse.json({
      cards: [],
      totalCount: 0,
      page,
      hasMore: false,
      languageFilter: "english",
      catalogSource: "local",
      catalogReady: true,
    })
  } catch (error) {
    console.error("[binder/search] failed:", error)
    const message = error instanceof Error ? error.message : "Search unavailable"
    return NextResponse.json({ error: message, catalogReady: false }, { status: 503 })
  }
}
