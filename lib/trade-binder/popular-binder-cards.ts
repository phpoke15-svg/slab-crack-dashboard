import { unstable_cache } from "next/cache"
import { getPricedCatalogCards } from "@/lib/db/priced-catalog"
import type { BinderSearchResultCard } from "@/lib/trade-binder/binder-search"
import { mergeBinderSearchResults } from "@/lib/trade-binder/binder-search"
import { attachBinderCardPrices } from "@/lib/trade-binder/binder-prices"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"
import {
  fetchPokemonCatalogPage,
  pokemonApiToBinderCard,
} from "@/lib/trade-binder/pokemon-catalog"
import { sortPricedCatalog } from "@/lib/trade-binder/priced-catalog"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import {
  extractCardPrices,
  fetchPriceChartingProduct,
  fetchPriceChartingProducts,
  type PriceChartingProduct,
  type PriceChartingSearchHit,
} from "@/lib/pricecharting"

/** Iconic chase cards — used to seed PriceCharting when the priced catalog is thin. */
const POPULAR_PRICECHARTING_QUERIES = [
  "charizard #4 pokemon base set",
  "blastoise #2 pokemon base set",
  "venusaur #15 pokemon base set",
  "pikachu illustrator pokemon",
  "umbreon vmax alt pokemon evolving skies",
  "espeon vmax alt pokemon evolving skies",
  "rayquaza vmax alt pokemon evolving skies",
  "gengar vmax alt pokemon fusion strike",
  "charizard ex pokemon 151",
  "mew ex pokemon 151",
  "lugia vmax alt pokemon silver tempest",
  "giratina vmax alt pokemon lost origin",
  "charizard vmax rainbow pokemon darkness ablaze",
  "charizard vmax pokemon champions path",
  "mew vmax alt pokemon fusion strike",
  "celebi vmax alt pokemon chilling reign",
  "arceus vmax alt pokemon brilliant stars",
  "origin forme dialga vmax alt pokemon astral radiance",
  "origin forme palkia vmax alt pokemon astral radiance",
  "charizard gx pokemon hidden fates",
  "charizard ex pokemon obsidian flames",
  "mew ex pokemon paldean fates",
  "pikachu vmax pokemon vivid voltage",
  "umbreon ex pokemon prismatic evolutions",
  "charizard ex pokemon prismatic evolutions",
  "mewtwo gx pokemon shining legends",
  "lugia pokemon neo genesis",
  "tyranitar pokemon neo discovery",
  "blaine's charizard pokemon gym challenge",
  "reshiram charizard gx pokemon unbroken bonds",
] as const

function isPokemonCardProduct(hit: PriceChartingSearchHit): boolean {
  const consoleName = (hit["console-name"] ?? "").toLowerCase()
  if (!consoleName.includes("pokemon")) return false
  if (/\b(nintendo|3ds|switch|gameboy|wii|ds)\b/.test(consoleName) && !consoleName.includes("card")) {
    return false
  }
  return true
}

function parseCardNumberFromProductName(productName: string): string {
  const hashMatch = productName.match(/#(\d{1,4}[a-z/-]*)/i)
  if (hashMatch) return hashMatch[1]
  const trailingMatch = productName.match(/\b(\d{1,4})\b(?=[^0-9]*$)/)
  return trailingMatch?.[1] ?? ""
}

function priceChartingProductToBinderCard(product: PriceChartingProduct): BinderSearchResultCard | null {
  const id = product.id
  if (!id) return null

  const productName = product["product-name"] ?? "Unknown card"
  const setName = (product["console-name"] ?? "Unknown set").replace(/^Pokemon\s+/i, "").trim()
  const cardNumber = parseCardNumberFromProductName(productName)
  const name =
    productName
      .replace(/\s*#\d+.*$/i, "")
      .replace(/\s+\d{1,4}\/[a-z0-9-]+$/i, "")
      .trim() || productName
  const rawPrice = extractCardPrices(product).rawPrice

  return {
    id: `pc-${id}`,
    name,
    set: setName,
    rarity: mapPokemonRarity(undefined),
    image: "/placeholder.svg",
    cardNumber: cardNumber || undefined,
    rawPrice: rawPrice > 0 ? rawPrice : undefined,
  }
}

async function popularFromPricedCatalog(limit: number): Promise<BinderSearchResultCard[]> {
  const catalog = sortPricedCatalog(await getPricedCatalogCards())
  const cards: BinderSearchResultCard[] = []

  for (const card of catalog) {
    if (cards.length >= limit) break
    if (card.rawPrice <= 0) continue

    cards.push({
      id: card.id,
      name: card.name,
      set: card.set,
      rarity: card.rarity,
      image: upgradeCardImageUrlSync(card.image),
      cardNumber: card.cardNumber,
      rawPrice: card.rawPrice,
    })
  }

  return cards
}

async function popularFromPriceCharting(limit: number): Promise<BinderSearchResultCard[]> {
  const apiKey = process.env.PRICECHARTING_API_KEY
  if (!apiKey) return []

  const resolvedIds: string[] = []

  for (const query of POPULAR_PRICECHARTING_QUERIES) {
    if (resolvedIds.length >= limit + 8) break
    try {
      const hits = await fetchPriceChartingProducts(apiKey, query)
      const match = hits.find((hit) => hit.id && isPokemonCardProduct(hit))
      if (match?.id && !resolvedIds.includes(match.id)) {
        resolvedIds.push(match.id)
      }
    } catch {
      /* try next query */
    }
  }

  const cards: BinderSearchResultCard[] = []

  for (let i = 0; i < resolvedIds.length; i += 4) {
    const batch = resolvedIds.slice(i, i + 4)
    const products = await Promise.all(
      batch.map(async (id) => {
        try {
          return await fetchPriceChartingProduct(apiKey, { id })
        } catch {
          return null
        }
      }),
    )

    for (const product of products) {
      if (!product) continue
      const card = priceChartingProductToBinderCard(product)
      if (card) cards.push(card)
    }
  }

  return cards
    .sort((a, b) => (b.rawPrice ?? 0) - (a.rawPrice ?? 0))
    .slice(0, limit)
}

async function popularFromPokemonApi(limit: number): Promise<BinderSearchResultCard[]> {
  const { cards: apiCards } = await fetchPokemonCatalogPage(1, Math.min(limit, 80))
  return apiCards
    .map((card) => pokemonApiToBinderCard(card, 0))
    .filter((card): card is NonNullable<typeof card> => card !== null)
    .slice(0, limit)
    .map((card) => ({
      id: card.id,
      name: card.name,
      set: card.set,
      rarity: card.rarity,
      image: card.image,
      cardNumber: card.cardNumber,
      rawPrice: undefined,
    }))
}

export async function fetchPopularBinderCardsUncached(limit: number): Promise<BinderSearchResultCard[]> {
  const [fromCatalog, fromPriceCharting] = await Promise.all([
    popularFromPricedCatalog(limit),
    popularFromPriceCharting(limit),
  ])

  let cards = mergeBinderSearchResults([...fromCatalog, ...fromPriceCharting], "")
  cards = cards.sort((a, b) => (b.rawPrice ?? 0) - (a.rawPrice ?? 0))

  if (cards.length < limit) {
    const fallback = await popularFromPokemonApi(limit)
    cards = mergeBinderSearchResults([...cards, ...fallback], "")
    cards = cards.sort((a, b) => (b.rawPrice ?? 0) - (a.rawPrice ?? 0))
  }

  cards = cards.slice(0, limit)

  const needsPrice = cards
    .filter((card) => !card.rawPrice || card.rawPrice <= 0)
    .slice(0, 12)
    .map((card) => ({
      id: card.id,
      name: card.name,
      set: card.set,
      cardNumber: card.cardNumber,
    }))

  if (needsPrice.length > 0 && process.env.PRICECHARTING_API_KEY) {
    const prices = await attachBinderCardPrices(needsPrice, { limit: 12, concurrency: 3 })
    cards = cards.map((card) => {
      const rawPrice = prices.get(card.id)
      return rawPrice && rawPrice > 0 ? { ...card, rawPrice } : card
    })
    cards.sort((a, b) => (b.rawPrice ?? 0) - (a.rawPrice ?? 0))
  }

  return cards.slice(0, limit)
}

const getCachedPopularBinderCards = unstable_cache(
  () => fetchPopularBinderCardsUncached(30),
  ["popular-binder-cards-30"],
  { revalidate: 3600, tags: ["popular-binder-cards"] },
)

export async function fetchPopularBinderCards(limit = 30): Promise<BinderSearchResultCard[]> {
  const cards = await getCachedPopularBinderCards()
  return cards.slice(0, limit)
}
