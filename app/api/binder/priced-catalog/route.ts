import { NextRequest, NextResponse } from "next/server"
import { getRawPricesForCardIds } from "@/lib/db/priced-catalog"
import {
  fetchPokemonCatalogPage,
  pokemonApiToBinderCard,
  searchPokemonCatalog,
} from "@/lib/trade-binder/pokemon-catalog"
import type { PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"
import { filterPricedCatalog } from "@/lib/trade-binder/priced-catalog"

export const maxDuration = 60

function catalogId(card: PokemonApiCard): string {
  return card.id.startsWith("poke-") ? card.id : `poke-${card.id}`
}

function toResponseCards(apiCards: PokemonApiCard[], rawPriceByCardId: Map<string, number>) {
  return apiCards
    .map((card) => pokemonApiToBinderCard(card, rawPriceByCardId.get(catalogId(card)) ?? 0))
    .filter((card): card is NonNullable<typeof card> => card !== null)
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 60), 500)
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0)
  const page = Math.floor(offset / limit) + 1

  try {
    if (q.length >= 1) {
      const { cards: apiCards } = await searchPokemonCatalog(q, limit)
      const rawPriceByCardId = await getRawPricesForCardIds(apiCards.map((card) => catalogId(card)))
      const cards = toResponseCards(apiCards, rawPriceByCardId)
      const filtered = filterPricedCatalog(cards, q)

      return NextResponse.json({
        cards: filtered,
        total: filtered.length,
        offset,
        limit,
        languageFilter: "english-japanese",
      })
    }

    const { cards: apiCards, totalCount, pageSize } = await fetchPokemonCatalogPage(page, limit)
    const rawPriceByCardId = await getRawPricesForCardIds(apiCards.map((card) => catalogId(card)))
    const cards = toResponseCards(apiCards, rawPriceByCardId)

    return NextResponse.json({
      cards,
      total: totalCount,
      offset,
      limit: pageSize,
      languageFilter: "english-japanese",
    })
  } catch (error) {
    console.error("[priced-catalog] failed:", error)
    return NextResponse.json({ error: "Could not load priced catalog" }, { status: 503 })
  }
}
