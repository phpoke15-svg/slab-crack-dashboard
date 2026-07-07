import { NextRequest, NextResponse } from "next/server"
import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import {
  fetchPokemonCatalogPage,
  pokemonApiToBinderCard,
} from "@/lib/trade-binder/pokemon-catalog"
import { buildPokemonSearchQuery, type PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"

export const maxDuration = 60

function toSearchCards(apiCards: PokemonApiCard[], rawPriceByCardId: Map<string, number>) {
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
        rawPrice: binderCard.rawPrice > 0 ? binderCard.rawPrice : undefined,
      }
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1), 1)
  const pageSize = Math.min(Number(request.nextUrl.searchParams.get("pageSize") ?? 40), 80)

  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

  try {
    const rawPriceByCardId = await getRawPriceByCardId()

    if (q.length >= 1) {
      const url = new URL("https://api.pokemontcg.io/v2/cards")
      url.searchParams.set("q", buildPokemonSearchQuery(q))
      url.searchParams.set("pageSize", String(pageSize))
      url.searchParams.set("page", String(page))
      url.searchParams.set("orderBy", "-set.releaseDate")

      const res = await fetch(url, { headers, next: { revalidate: 300 } })
      if (!res.ok) {
        return NextResponse.json({ error: "Search failed" }, { status: res.status })
      }

      const data = (await res.json()) as { data?: PokemonApiCard[]; totalCount?: number }
      const apiCards = data.data ?? []
      const totalCount = data.totalCount ?? apiCards.length
      const cards = toSearchCards(apiCards, rawPriceByCardId)

      return NextResponse.json({
        cards,
        totalCount,
        page,
        hasMore: page * pageSize < totalCount,
        languageFilter: "english-japanese",
      })
    }

    const { cards: apiCards, totalCount, pageSize: apiPageSize } = await fetchPokemonCatalogPage(
      page,
      pageSize,
    )
    const cards = toSearchCards(apiCards, rawPriceByCardId)

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
