import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { lookupCardById } from "@/lib/card-lookup"
import { hasTcgGoApiKey } from "@/lib/pricing/provider"
import {
  fetchTcgGoCardsByTcgIds,
  tcgGoCardToCatalogCard,
} from "@/lib/tcggo-api"
import type { CatalogCard } from "@/lib/trade-binder/cards"
import { mapPokemonRarity, toCatalogCard, type PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"

async function fetchPokemonCardsByIds(pokemonIds: string[]): Promise<CatalogCard[]> {
  if (pokemonIds.length === 0) return []

  if (hasTcgGoApiKey()) {
    const cards: CatalogCard[] = []
    for (let i = 0; i < pokemonIds.length; i += 20) {
      const chunk = pokemonIds.slice(i, i + 20)
      const hits = await fetchTcgGoCardsByTcgIds(chunk)
      for (const hit of hits) {
        const catalog = tcgGoCardToCatalogCard(hit)
        cards.push({
          id: catalog.id.startsWith("poke-") ? catalog.id : `poke-${catalog.id}`,
          name: catalog.name,
          set: catalog.setName,
          rarity: mapPokemonRarity(catalog.rarity ?? undefined),
          image: upgradeCardImageUrlSync(catalog.imageLarge ?? catalog.imageSmall ?? "/placeholder.svg"),
          cardNumber: catalog.cardNumber,
        })
      }
    }
    return cards
  }

  const query = pokemonIds.map((id) => `id:${id}`).join(" OR ")
  const url = new URL("https://api.pokemontcg.io/v2/cards")
  url.searchParams.set("q", query)
  url.searchParams.set("pageSize", String(pokemonIds.length))

  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

  const res = await fetch(url, { headers, next: { revalidate: 3600 } })
  if (!res.ok) return []

  const data = await res.json()
  return ((data.data as PokemonApiCard[]) ?? []).map((card) => {
    const catalog = toCatalogCard(card)
    return {
      id: catalog.id.startsWith("poke-") ? catalog.id : `poke-${catalog.id}`,
      name: catalog.name,
      set: catalog.setName,
      rarity: mapPokemonRarity(catalog.rarity ?? undefined),
      image: upgradeCardImageUrlSync(catalog.imageLarge ?? catalog.imageSmall ?? "/placeholder.svg"),
      cardNumber: catalog.cardNumber,
    }
  })
}

async function fetchPriceChartingCardsByIds(pcIds: string[]): Promise<CatalogCard[]> {
  const cards: CatalogCard[] = []

  for (const id of pcIds.slice(0, 20)) {
    try {
      const entry = await lookupCardById(id)
      if (!entry) continue
      cards.push({
        id,
        name: entry.cardName.replace(/\s+\([^)]+\)$/, ""),
        set: entry.setName,
        rarity: mapPokemonRarity(entry.cardName.match(/\(([^)]+)\)$/)?.[1]),
        image: upgradeCardImageUrlSync(entry.imageUrl || "/placeholder.svg"),
      })
    } catch {
      /* skip failed lookup */
    }
  }

  return cards
}

/** Resolve catalog metadata for binder card ids (server-safe, no HTTP self-fetch). */
export async function lookupCatalogCardsByIds(ids: string[]): Promise<CatalogCard[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50)
  if (unique.length === 0) return []

  const pcIds = unique.filter((id) => id.startsWith("pc-"))
  const pokemonIds = unique
    .filter((id) => !id.startsWith("pc-"))
    .map((id) => (id.startsWith("poke-") ? id.slice("poke-".length) : id))

  const [pokemonCards, pcCards] = await Promise.all([
    fetchPokemonCardsByIds(pokemonIds),
    hasTcgGoApiKey() ? Promise.resolve([]) : fetchPriceChartingCardsByIds(pcIds),
  ])

  return [...pokemonCards, ...pcCards]
}

export function catalogCardsByStoredId(cards: CatalogCard[]): Map<string, CatalogCard> {
  const map = new Map<string, CatalogCard>()
  for (const card of cards) {
    map.set(card.id, card)
    if (!card.id.startsWith("poke-") && !card.id.startsWith("pc-")) {
      map.set(`poke-${card.id}`, card)
    }
    if (card.id.startsWith("poke-")) {
      map.set(card.id.slice("poke-".length), card)
    }
  }
  return map
}
