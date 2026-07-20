import type { PokemonApiCard } from "@/lib/trade-binder/pokemon-tcg"
import {
  buildPokemonSearchQueries,
  cardNumberMatches,
  mapPokemonRarity,
  parseBinderSearchTokens,
  resolveBinderSetIdHint,
} from "@/lib/trade-binder/pokemon-tcg"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { hasTcgGoApiKey } from "@/lib/pricing/provider"
import {
  catalogIdFromTcgGoCard,
  extractTcgGoCardPrices,
  fetchTcgGoCardByTcgId,
  fetchTcgGoCardByTcgplayerId,
  fetchTcgGoCardsByEpisodeCode,
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
import { promoCardMetaByTcgId } from "@/lib/trade-binder/promo-card-meta"

const POKEMON_PAGE_SIZE = 50
const PROMO_EPISODE_CODES = ["mep"] as const

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

/** Search mapping — include promos and new sets not yet in the local catalog. */
export function tcgGoToSearchBinderCard(card: TcgGoCard): PricedCatalogCard | null {
  const name = card.name?.trim()
  if (!name) return null

  const prices = extractTcgGoCardPrices(card)
  const image = tcgGoCardImageUrl(card) ?? "/placeholder.svg"

  return {
    id: catalogIdFromTcgGoCard(card),
    name,
    set: tcgGoCardSetName(card),
    rarity: mapPokemonRarity(card.rarity ?? undefined),
    image: upgradeCardImageUrlSync(image),
    rawPrice: prices.rawPrice,
    cardNumber: tcgGoCardNumber(card) || undefined,
  }
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

function tcgGoMatchesNameAndNumber(card: TcgGoCard, name: string, number: string): boolean {
  const normalizedName = name.toLowerCase().trim()
  const cardName = (card.name ?? "").toLowerCase()
  const nameMatches =
    !normalizedName ||
    cardName.includes(normalizedName) ||
    normalizedName.split(/\s+/).every((token) => token.length > 1 && cardName.includes(token))
  if (!nameMatches) return false

  const numberCandidates = [
    tcgGoCardNumber(card),
    card.card_code_number ?? "",
    card.tcgid?.split("-").pop() ?? "",
  ]
  return numberCandidates.some((candidate) => cardNumberMatches(candidate, number))
}

function filterTcgGoByNameAndNumber(cards: TcgGoCard[], name: string, number: string): TcgGoCard[] {
  return cards.filter((card) => tcgGoMatchesNameAndNumber(card, name, number))
}

async function safeSearchTcgGoCards(
  params: Parameters<typeof searchTcgGoCards>[0],
): Promise<TcgGoCard[]> {
  try {
    return await searchTcgGoCards(params)
  } catch (error) {
    console.warn("[pokemon-catalog] TCGGO search failed:", params, error)
    return []
  }
}

async function searchTcgGoPromoEpisode(
  episodeCode: string,
  name: string,
  number: string,
): Promise<TcgGoCard[]> {
  const cards = await fetchTcgGoCardsByEpisodeCode(episodeCode, 120)
  return filterTcgGoByNameAndNumber(cards, name, number)
}

async function searchTcgGoByNameAndNumber(
  name: string,
  number: string,
  pageSize: number,
): Promise<TcgGoCard[]> {
  const normalized = number.replace(/^#/, "").replace(/^0+/, "") || number
  const padded = normalized.padStart(3, "0")

  const directIds = [`mep-${normalized}`, `mep-${padded}`]
  const directCards = await Promise.all(directIds.map((tcgId) => fetchTcgGoCardByTcgId(tcgId)))
  for (const card of directCards) {
    if (!card) continue
    if (tcgGoMatchesNameAndNumber(card, name, number)) return [card]
    const tcgId = card.tcgid?.toLowerCase() ?? ""
    if (
      tcgId === `mep-${normalized}` &&
      (card.name ?? "").toLowerCase().includes(name.toLowerCase().trim())
    ) {
      return [card]
    }
  }

  for (const tcgId of directIds) {
    const meta = promoCardMetaByTcgId(tcgId)
    if (meta?.tcgplayerId) {
      const card = await fetchTcgGoCardByTcgplayerId(meta.tcgplayerId)
      if (card && tcgGoMatchesNameAndNumber(card, name, number)) return [card]
    }
  }

  for (const episodeCode of PROMO_EPISODE_CODES) {
    const promoMatches = await searchTcgGoPromoEpisode(episodeCode, name, number)
    if (promoMatches.length > 0) return promoMatches
  }

  const searchAttempts = [
    `${name} ${number}`,
    `${name} ${padded}`,
    `${name} ${normalized}`,
    `mep-${normalized}`,
    `mep-${padded}`,
    name,
  ]

  for (const search of searchAttempts) {
    const hits = await safeSearchTcgGoCards({ search, perPage: Math.max(pageSize, 80) })
    const matched = filterTcgGoByNameAndNumber(hits, name, number)
    if (matched.length > 0) return matched
  }

  for (const tcgId of directIds) {
    const hits = await safeSearchTcgGoCards({ search: tcgId, tcgId, perPage: 5 })
    const matched = filterTcgGoByNameAndNumber(hits, name, number)
    if (matched.length > 0) return matched
  }

  return []
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

    const resolved = resolveBinderSetIdHint(setHint) ?? setHint.toLowerCase()
    if (PROMO_EPISODE_CODES.includes(resolved as (typeof PROMO_EPISODE_CODES)[number]) && name) {
      const promoMatches = await searchTcgGoPromoEpisode(resolved, name, number)
      if (promoMatches.length > 0) return promoMatches
    }
  }

  if (name && number) {
    const exact = await searchTcgGoByNameAndNumber(name, number, pageSize)
    if (exact.length > 0) return exact.slice(0, pageSize)
  }

  const attempts = [...new Set([
    trimmed,
    name && number ? `${name} ${number}` : "",
    name,
    name.split(/\s+/).slice(-2).join(" "),
    setHint && number ? `${setHint} ${number}` : "",
    setHint && name ? `${name} ${setHint}` : "",
  ].filter((value): value is string => Boolean(value && value.trim())))]

  for (const attempt of attempts) {
    const hits = await safeSearchTcgGoCards({
      search: attempt,
      perPage: pageSize,
    })
    if (hits.length === 0) continue
    if (name && number) {
      const matched = filterTcgGoByNameAndNumber(hits, name, number)
      if (matched.length > 0) return matched.slice(0, pageSize)
      continue
    }
    return hits
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
    const priced = tcgGoToSearchBinderCard(hit)
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
    try {
      const hits = await searchTcgGoCatalog(query, pageSize)
      const cards = hits.map(tcgGoToPokemonApiCard)
      return { cards, totalCount: cards.length }
    } catch (error) {
      console.warn("[pokemon-catalog] TCGGO catalog search failed:", error)
      return { cards: [], totalCount: 0 }
    }
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
