import { NextRequest, NextResponse } from "next/server"
import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import { searchBinderCatalog } from "@/lib/trade-binder/catalog-search"
import {
  fetchPokemonCatalogPage,
  pokemonApiToBinderCard,
} from "@/lib/trade-binder/pokemon-catalog"

export const maxDuration = 10

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1), 1)
  const pageSize = Math.min(Number(request.nextUrl.searchParams.get("pageSize") ?? 40), 80)

  try {
    if (q.length >= 2) {
      const [rawPriceByCardId, cards] = await Promise.all([
        getRawPriceByCardId(),
        searchBinderCatalog(q, { limit: pageSize }),
      ])

      const pricedCards = cards.map((card) => {
        const rawPrice = rawPriceByCardId.get(card.id)
        return rawPrice && rawPrice > 0 ? { ...card, rawPrice } : card
      })

      return NextResponse.json({
        cards: pricedCards,
        totalCount: pricedCards.length,
        page: 1,
        hasMore: false,
        languageFilter: "english-japanese",
      })
    }

    const rawPriceByCardId = await getRawPriceByCardId()

    const { cards: apiCards, totalCount, pageSize: apiPageSize } = await fetchPokemonCatalogPage(
      page,
      pageSize,
    )
    const cards = apiCards
      .map((card) => {
        const binderCard = pokemonApiToBinderCard(card, rawPriceByCardId.get(card.id) ?? 0)
        if (!binderCard) return null
        return {
          id: binderCard.id,
          name: binderCard.name,
          set: binderCard.set,
          rarity: binderCard.rarity,
          image: binderCard.image,
          rawPrice: binderCard.rawPrice > 0 ? binderCard.rawPrice : undefined,
        }
      })
      .filter((card): card is NonNullable<typeof card> => card !== null)

    return NextResponse.json({
      cards,
      totalCount,
      page,
      hasMore: page * apiPageSize < totalCount,
      languageFilter: "english-japanese",
    })
  } catch (error) {
    console.error("[binder/search] failed:", error)
    return NextResponse.json({ error: "Search unavailable" }, { status: 503 })
  }
}
