import type { PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"
import {
  isEnglishOrJapanesePricedCard,
  type PricedCatalogCard,
} from "@/lib/trade-binder/priced-catalog"

const POKEMON_PAGE_SIZE = 250

export function pokemonApiToBinderCard(
  card: PokemonApiCard,
  rawPrice = 0,
): PricedCatalogCard | null {
  const setName = card.set?.name ?? "Unknown Set"
  if (!isEnglishOrJapanesePricedCard({ setName, productName: card.name })) {
    return null
  }

  return {
    id: card.id,
    name: card.name,
    set: setName,
    rarity: mapPokemonRarity(card.rarity),
    image: card.images?.large ?? card.images?.small ?? "/placeholder.svg",
    rawPrice: Math.max(0, rawPrice),
    cardNumber: card.number,
  }
}

export async function fetchPokemonCatalogPage(
  page: number,
  pageSize = POKEMON_PAGE_SIZE,
): Promise<{ cards: PokemonApiCard[]; totalCount: number; pageSize: number }> {
  const url = new URL("https://api.pokemontcg.io/v2/cards")
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))
  url.searchParams.set("orderBy", "-set.releaseDate")

  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

  const res = await fetch(url, { headers, next: { revalidate: 3600 } })
  if (!res.ok) {
    throw new Error(`Pokémon TCG API HTTP ${res.status}`)
  }

  const payload = (await res.json()) as {
    data?: PokemonApiCard[]
    totalCount?: number
    pageSize?: number
  }

  return {
    cards: payload.data ?? [],
    totalCount: payload.totalCount ?? payload.data?.length ?? 0,
    pageSize: payload.pageSize ?? pageSize,
  }
}

export { POKEMON_PAGE_SIZE }
