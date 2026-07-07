import { NextRequest, NextResponse } from "next/server"
import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import {
  fetchPokemonCatalogPage,
  pokemonApiToBinderCard,
} from "@/lib/trade-binder/pokemon-catalog"
import { buildPokemonSearchQuery, type PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"
import { filterPricedCatalog } from "@/lib/trade-binder/priced-catalog"

export const maxDuration = 10

function toResponseCards(apiCards: PokemonApiCard[], rawPriceByCardId: Map<string, number>) {
  return apiCards
    .map((card) => pokemonApiToBinderCard(card, rawPriceByCardId.get(card.id) ?? 0))
    .filter((card): card is NonNullable<typeof card> => card !== null)
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 60), 500)
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0)
  const page = Math.floor(offset / limit) + 1

  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

  try {
    const rawPriceByCardId = await getRawPriceByCardId()

    if (q.length >= 1) {
      const url = new URL("https://api.pokemontcg.io/v2/cards")
      url.searchParams.set("q", buildPokemonSearchQuery(q))
      url.searchParams.set("pageSize", String(limit))
      url.searchParams.set("page", String(page))
      url.searchParams.set("orderBy", "-set.releaseDate")

      const res = await fetch(url, { headers, next: { revalidate: 300 } })
      if (!res.ok) {
        return NextResponse.json({ error: "Could not load priced catalog" }, { status: res.status })
      }

      const data = (await res.json()) as { data?: PokemonApiCard[]; totalCount?: number }
      const cards = toResponseCards(data.data ?? [], rawPriceByCardId)
      const filtered = filterPricedCatalog(cards, q)

      return NextResponse.json({
        cards: filtered,
        total: data.totalCount ?? filtered.length,
        offset,
        limit,
        languageFilter: "english-japanese",
      })
    }

    const { cards: apiCards, totalCount, pageSize } = await fetchPokemonCatalogPage(page, limit)
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
