import type { PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"
import {
  buildPokemonSearchQueries,
  mapPokemonRarity,
  parseBinderSearchTokens,
} from "@/lib/trade-binder/pokemon-tcg"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
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
    image: upgradeCardImageUrlSync(card.images?.large ?? card.images?.small ?? "/placeholder.svg"),
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

export async function searchPokemonCatalog(
  query: string,
  pageSize = 40,
): Promise<{ cards: PokemonApiCard[]; totalCount: number }> {
  const queries = buildPokemonSearchQueries(query)
  if (queries.length === 0) return { cards: [], totalCount: 0 }

  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

  const { number } = parseBinderSearchTokens(query)
  const seen = new Set<string>()
  const cards: PokemonApiCard[] = []

  for (const q of queries) {
    const url = new URL("https://api.pokemontcg.io/v2/cards")
    url.searchParams.set("q", q)
    url.searchParams.set("pageSize", String(pageSize))
    url.searchParams.set("orderBy", "-set.releaseDate")

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    try {
      const res = await fetch(url, { headers, signal: controller.signal, next: { revalidate: 300 } })
      if (!res.ok) continue

      const payload = (await res.json()) as { data?: PokemonApiCard[]; totalCount?: number }
      for (const card of payload.data ?? []) {
        if (seen.has(card.id)) continue
        seen.add(card.id)
        cards.push(card)
      }

      if (number && cards.length > 0) {
        const hasNumberMatch = cards.some((card) => {
          const prefix =
            card.number
              ?.split("/")[0]
              ?.replace(/^#/, "")
              .replace(/^0+/, "") || ""
          const target = number.replace(/^0+/, "")
          return prefix === target
        })
        if (hasNumberMatch) break
      } else if (cards.length >= Math.min(pageSize, 10)) {
        break
      }
    } catch {
      continue
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    cards: cards.slice(0, pageSize),
    totalCount: cards.length,
  }
}

export { POKEMON_PAGE_SIZE }
