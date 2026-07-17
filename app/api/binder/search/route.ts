import { NextRequest, NextResponse } from "next/server"
import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import { mergeBinderSearchResults, type BinderSearchResultCard } from "@/lib/trade-binder/binder-search"
import { searchBinderCatalog } from "@/lib/trade-binder/catalog-search"
import {
  attachBinderCardPrices,
  mergePricesIntoCards,
} from "@/lib/trade-binder/binder-prices"
import {
  fetchPokemonCatalogPage,
  pokemonApiToBinderCard,
  searchPokemonCatalog,
} from "@/lib/trade-binder/pokemon-catalog"
import { fetchPopularBinderCards } from "@/lib/trade-binder/popular-binder-cards"

export const maxDuration = 30

function mapApiCardsToBinder(
  apiCards: Awaited<ReturnType<typeof searchPokemonCatalog>>["cards"],
  rawPriceByCardId: Map<string, number>,
): BinderSearchResultCard[] {
  return apiCards
    .map((card) => {
      const binderCard = pokemonApiToBinderCard(card, rawPriceByCardId.get(card.id) ?? 0)
      if (!binderCard) return null
      return {
        id: binderCard.id,
        name: binderCard.name,
        set: binderCard.set,
        rarity: binderCard.rarity,
        image: binderCard.image,
        cardNumber: binderCard.cardNumber,
        rawPrice: binderCard.rawPrice > 0 ? binderCard.rawPrice : undefined,
      }
    })
    .filter((card): card is BinderSearchResultCard => card !== null)
}

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

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1), 1)
  const pageSize = Math.min(Number(request.nextUrl.searchParams.get("pageSize") ?? 40), 80)

  try {
    if (q.length >= 2) {
      const rawPriceByCardId = await getRawPriceByCardId()

      const [apiResult, catalogCards] = await Promise.all([
        searchPokemonCatalog(q, pageSize).catch((error) => {
          console.warn("[binder/search] Pokemon API failed:", error)
          return { cards: [], totalCount: 0 }
        }),
        searchBinderCatalog(q, { limit: pageSize, rawPriceByCardId, budgetMs: 12_000 }).catch((error) => {
          console.warn("[binder/search] Catalog search failed:", error)
          return []
        }),
      ])

      const cards = mergeBinderSearchResults(
        [...mapApiCardsToBinder(apiResult.cards, rawPriceByCardId), ...mapCatalogCardsToBinder(catalogCards)],
        q,
      ).slice(0, pageSize)

      return NextResponse.json({
        cards,
        totalCount: cards.length,
        page: 1,
        hasMore: false,
        languageFilter: "english-japanese",
      })
    }

    const rawPriceByCardId = await getRawPriceByCardId()

    if (page === 1) {
      const cards = await fetchPopularBinderCards(Math.min(pageSize, 30))
      return NextResponse.json({
        cards,
        totalCount: cards.length,
        page: 1,
        hasMore: false,
        featured: true,
        languageFilter: "english-japanese",
      })
    }

    const { cards: apiCards, totalCount, pageSize: apiPageSize } = await fetchPokemonCatalogPage(
      page,
      pageSize,
    )
    let cards = mapApiCardsToBinder(apiCards, rawPriceByCardId)

    const needsPrice = cards
      .filter((card) => !card.rawPrice || card.rawPrice <= 0)
      .slice(0, 12)
      .map((card) => ({
        id: card.id,
        name: card.name,
        set: card.set,
        cardNumber: card.cardNumber,
      }))

    if (needsPrice.length > 0) {
      const fetched = await attachBinderCardPrices(needsPrice, {
        cachedPrices: rawPriceByCardId,
        cacheOnly: true,
      })
      cards = mergePricesIntoCards(cards, fetched)
    }

    return NextResponse.json({
      cards,
      totalCount,
      page,
      hasMore: page * apiPageSize < totalCount,
      languageFilter: "english-japanese",
    })
  } catch (error) {
    console.error("[binder/search] failed:", error)
    const message = error instanceof Error ? error.message : "Search unavailable"
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
