import { NextRequest, NextResponse } from "next/server"
import { getRawPricesForCardIds } from "@/lib/db/priced-catalog"
import {
  fetchPokemonCatalogPage,
  pokemonApiToBinderCard,
  POKEMON_PAGE_SIZE,
} from "@/lib/trade-binder/pokemon-catalog"

export const maxDuration = 10

export async function GET(request: NextRequest) {
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1), 1)

  try {
    const { cards: apiCards, totalCount, pageSize } = await fetchPokemonCatalogPage(page)
    const rawPriceByCardId = await getRawPricesForCardIds(apiCards.map((card) => card.id))

    const cards = apiCards
      .map((card) => pokemonApiToBinderCard(card, rawPriceByCardId.get(card.id) ?? 0))
      .filter((card): card is NonNullable<typeof card> => card !== null)

    const hasMore = page * pageSize < totalCount

    return NextResponse.json({
      cards,
      page,
      pageSize: POKEMON_PAGE_SIZE,
      hasMore,
      totalCount,
      languageFilter: "english-japanese",
    })
  } catch (error) {
    console.error("[binder/import-page] failed:", error)
    return NextResponse.json({ error: "Could not load catalog page" }, { status: 503 })
  }
}
