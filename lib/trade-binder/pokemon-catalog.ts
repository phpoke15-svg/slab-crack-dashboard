import type { PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"
import {
  buildPokemonSearchQueries,
  mapPokemonRarity,
  parseBinderSearchTokens,
  resolveBinderSetIdHint,
} from "@/lib/trade-binder/pokemon-tcg"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { hasTcgGoApiKey } from "@/lib/pricing/provider"
import {
  extractTcgGoCardPrices,
  fetchTcgGoCardByTcgId,
  fetchTcgGoCatalogPage,
  searchTcgGoCards,
  tcgGoCardImageUrl,
  tcgGoCardNumber,
  tcgGoCardSetName,
  type TcgGoCard,
} from "@/lib/tcggo-api"
import {
  isEnglishOrJapanesePricedCard,
  type PricedCatalogCard,
} from "@/lib/trade-binder/priced-catalog"

const POKEMON_PAGE_SIZE = 50

function tcgGoToPokemonApiCard(card: TcgGoCard): PokemonApiCard {
  const image = tcgGoCardImageUrl(card) ?? undefined
  return {
    id: card.tcgid ?? String(card.id ?? ""),
    name: card.name ?? "Unknown",
    number: tcgGoCardNumber(card),
    rarity: card.rarity ?? undefined,
    set: { id: card.episode?.code, name: tcgGoCardSetName(card) },
    images: image ? { small: image, large: image } : undefined,
  }
}

export function pokemonApiToBinderCard(
  card: PokemonApiCard,
  rawPrice = 0,
): PricedCatalogCard | null {
  const setName = card.set?.name ?? "Unknown Set"
  if (!isEnglishOrJapanesePricedCard({ setName, productName: card.name })) {
    return null
  }

  return {
    id: card.id.startsWith("poke-") ? card.id : `poke-${card.id}`,
    name: card.name,
    set: setName,
    rarity: mapPokemonRarity(card.rarity),
    image: upgradeCardImageUrlSync(card.images?.large ?? card.images?.small ?? "/placeholder.svg"),
    rawPrice: Math.max(0, rawPrice),
    cardNumber: card.number,
  }
}

export function tcgGoToBinderCard(card: TcgGoCard): PricedCatalogCard | null {
  const apiCard = tcgGoToPokemonApiCard(card)
  const prices = extractTcgGoCardPrices(card)
  return pokemonApiToBinderCard(apiCard, prices.rawPrice)
}

export async function fetchPokemonCatalogPage(
  page: number,
  pageSize = POKEMON_PAGE_SIZE,
): Promise<{ cards: PokemonApiCard[]; totalCount: number; pageSize: number }> {
  if (hasTcgGoApiKey()) {
    const result = await fetchTcgGoCatalogPage(page, pageSize)
    return {
      cards: result.cards.map(tcgGoToPokemonApiCard),
      totalCount: result.totalCount,
      pageSize: result.pageSize,
    }
  }

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

function tcgIdCandidatesForSetNumber(setHint: string, number: string): string[] {
  const resolved = resolveBinderSetIdHint(setHint) ?? setHint.toLowerCase()
  const normalizedNumber = number.replace(/^#/, "").replace(/^0+/, "") || number
  const padded = normalizedNumber.padStart(3, "0")
  return [...new Set([
    `${resolved}-${normalizedNumber}`,
    `${resolved}-${padded}`,
    `${setHint.toLowerCase()}-${normalizedNumber}`,
    `${setHint.toLowerCase()}-${padded}`,
  ])]
}

async function searchTcgGoCatalog(
  query: string,
  pageSize = 40,
): Promise<TcgGoCard[]> {
  const trimmed = query.trim()
  const { number, name, setHint } = parseBinderSearchTokens(trimmed)

  if (setHint && number) {
    for (const tcgId of tcgIdCandidatesForSetNumber(setHint, number)) {
      const card = await fetchTcgGoCardByTcgId(tcgId)
      if (card) return [card]
    }
  }

  const attempts = [...new Set([
    trimmed,
    name,
    name.split(/\s+/).slice(-2).join(" "),
    name.split(/\s+/).slice(-1)[0],
    setHint && number ? `${setHint} ${number}` : "",
    setHint && name ? `${name} ${setHint}` : "",
  ].filter((value): value is string => Boolean(value && value.trim())))]

  for (const attempt of attempts) {
    const hits = await searchTcgGoCards({
      search: attempt,
      name: name || undefined,
      cardNumber: number || undefined,
      perPage: pageSize,
    })
    if (hits.length > 0) return hits
  }

  return []
}

export async function searchTcgGoBinderCards(
  query: string,
  pageSize = 40,
): Promise<PricedCatalogCard[]> {
  const hits = await searchTcgGoCatalog(query, pageSize)
  const cards: PricedCatalogCard[] = []
  for (const hit of hits) {
    const priced = tcgGoToBinderCard(hit)
    if (priced) cards.push(priced)
  }
  return cards
}

export async function searchPokemonCatalog(
  query: string,
  pageSize = 40,
): Promise<{ cards: PokemonApiCard[]; totalCount: number }> {
  const { number, name, setHint } = parseBinderSearchTokens(query)

  if (hasTcgGoApiKey()) {
    const hits = await searchTcgGoCatalog(query, pageSize)
    const cards = hits.map(tcgGoToPokemonApiCard)
    return { cards, totalCount: cards.length }
  }

  const queries = buildPokemonSearchQueries(query)
  if (queries.length === 0) return { cards: [], totalCount: 0 }

  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

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
