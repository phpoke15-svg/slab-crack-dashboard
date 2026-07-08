import { NextRequest, NextResponse } from "next/server"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { lookupCardById } from "@/lib/card-lookup"
import { mapPokemonRarity, toCatalogCard, type PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"
import type { CatalogCard } from "@/lib/trade-binder/cards"

async function fetchPokemonCardsByIds(pokemonIds: string[]): Promise<CatalogCard[]> {
  if (pokemonIds.length === 0) return []

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
      ...catalog,
      image: upgradeCardImageUrlSync(catalog.image),
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

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids")?.trim()
  if (!idsParam) {
    return NextResponse.json({ cards: [] })
  }

  const ids = idsParam.split(",").filter(Boolean).slice(0, 50)
  if (ids.length === 0) {
    return NextResponse.json({ cards: [] })
  }

  const pcIds = ids.filter((id) => id.startsWith("pc-"))
  const pokemonIds = ids
    .filter((id) => !id.startsWith("pc-"))
    .map((id) => (id.startsWith("poke-") ? id.slice("poke-".length) : id))

  try {
    const [pokemonCards, pcCards] = await Promise.all([
      fetchPokemonCardsByIds(pokemonIds),
      fetchPriceChartingCardsByIds(pcIds),
    ])

    return NextResponse.json({ cards: [...pokemonCards, ...pcCards] })
  } catch {
    return NextResponse.json({ error: "Card lookup unavailable" }, { status: 503 })
  }
}
