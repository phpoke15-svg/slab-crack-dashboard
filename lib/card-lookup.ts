import {
  extractCardPrices,
  resolvePriceChartingForCard,
  type PriceChartingCardContext,
} from "@/lib/pricecharting"
import {
  fetchPokemonCardById,
  fetchPokemonCardsByQuery,
  type CatalogCard,
} from "@/lib/pokemon-tcg"
import {
  buildGradeQuotes,
  getBestGradeQuote,
  normalizeCardEntry,
  type MockCardEntry,
  type PsaGradeNumber,
} from "@/lib/slab-data"

export type CardSearchHit = {
  id: string
  pokemonTcgId: string
  cardName: string
  setName: string
  cardNumber: string
  imageUrl: string
  rarity: string | null
}

function escapeLucene(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function cardMatchesHints(card: CatalogCard, hints: string[]): boolean {
  const setNorm = normalizeToken(card.setName)
  const numNorm = normalizeToken(card.cardNumber.split("/")[0] ?? "")
  const nameNorm = normalizeToken(card.name)

  return hints.every(
    (hint) => setNorm.includes(hint) || numNorm.includes(hint) || nameNorm.includes(hint),
  )
}

/** Build a Pokémon TCG API query from free-text user input. */
export function buildUserSearchQuery(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""

  const numberOnly = trimmed.match(/^#?(\d{1,4})(?:\/(\d{1,4}))?$/)
  if (numberOnly) return `number:${numberOnly[1]}`

  const parts = trimmed.split(/\s+/).filter(Boolean)
  // Multi-word queries fetch by name only; extra tokens are filtered client-side.
  return `name:${escapeLucene(parts[0])}`
}

export function catalogToSearchHit(card: CatalogCard): CardSearchHit {
  return {
    id: `poke-${card.id}`,
    pokemonTcgId: card.id,
    cardName: card.name,
    setName: card.setName,
    cardNumber: card.cardNumber,
    imageUrl: card.imageLarge ?? card.imageSmall ?? "",
    rarity: card.rarity,
  }
}

export async function searchCatalogCards(query: string, limit = 12): Promise<CardSearchHit[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const numberOnly = trimmed.match(/^#?(\d{1,4})(?:\/(\d{1,4}))?$/)
  if (numberOnly) {
    const cards = await fetchPokemonCardsByQuery(`number:${numberOnly[1]}`, limit)
    return cards.slice(0, limit).map(catalogToSearchHit)
  }

  const parts = trimmed.split(/\s+/).filter(Boolean)
  const hints = parts.slice(1).map(normalizeToken).filter(Boolean)
  const pageSize = hints.length > 0 ? Math.min(50, limit * 4) : limit
  const cards = await fetchPokemonCardsByQuery(buildUserSearchQuery(trimmed), pageSize)
  const filtered = hints.length > 0 ? cards.filter((card) => cardMatchesHints(card, hints)) : cards
  const pool = filtered.length > 0 ? filtered : cards

  const seen = new Set<string>()
  const hits: CardSearchHit[] = []

  for (const card of pool) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    hits.push(catalogToSearchHit(card))
    if (hits.length >= limit) break
  }

  return hits
}

function formatCardName(name: string, rarity: string | null): string {
  if (!rarity) return name
  if (name.toLowerCase().includes(rarity.toLowerCase())) return name
  return `${name} (${rarity})`
}

function productToEntry(
  catalog: CatalogCard,
  product: Awaited<ReturnType<typeof resolvePriceChartingForCard>>["product"],
  pricechartingId?: string,
): MockCardEntry {
  const { rawPrice, grades } = extractCardPrices(product)
  const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number }>> = {}

  for (const { grade, price } of grades) {
    if (grade === 7 || grade === 8 || grade === 9) {
      if (price > 0) byGrade[grade] = { slabPrice: price }
    }
  }

  const gradeQuotes = buildGradeQuotes(rawPrice, byGrade)
  const best = getBestGradeQuote(gradeQuotes)
  const id = pricechartingId ? `pc-${pricechartingId}` : `poke-${catalog.id}`

  return normalizeCardEntry({
    id,
    cardName: formatCardName(catalog.name, catalog.rarity),
    setName: catalog.setName,
    cardNumber: catalog.cardNumber,
    imageUrl: catalog.imageLarge ?? catalog.imageSmall ?? "",
    rawPrice,
    slabGrade: best?.grade ?? 8,
    slabPrice: best?.slabPrice ?? 0,
    deficit: best?.deficit ?? 0,
    percentageSavings: best?.percentageSavings ?? 0,
    marketInsight: pricechartingId
      ? "Live PSA 7/8/9 comps from PriceCharting."
      : "Card catalog match — add PriceCharting API key for slab pricing.",
    gradeQuotes,
    hasPricing: rawPrice > 0 || gradeQuotes.some((q) => q.slabPrice > 0),
  })
}

export async function lookupCardByPokemonId(pokemonTcgId: string): Promise<MockCardEntry | null> {
  const catalog = await fetchPokemonCardById(pokemonTcgId)
  if (!catalog) return null

  const ctx: PriceChartingCardContext = {
    cardName: catalog.name,
    setName: catalog.setName,
    cardNumber: catalog.cardNumber,
  }

  const apiKey = process.env.PRICECHARTING_API_KEY
  if (!apiKey) {
    return normalizeCardEntry({
      id: `poke-${catalog.id}`,
      cardName: formatCardName(catalog.name, catalog.rarity),
      setName: catalog.setName,
      cardNumber: catalog.cardNumber,
      imageUrl: catalog.imageLarge ?? catalog.imageSmall ?? "",
      rawPrice: 0,
      slabGrade: 8,
      slabPrice: 0,
      deficit: 0,
      percentageSavings: 0,
      marketInsight: "Pricing unavailable — set PRICECHARTING_API_KEY on the server.",
      gradeQuotes: buildGradeQuotes(0, {}),
      hasPricing: false,
    })
  }

  try {
    const { product, resolvedId } = await resolvePriceChartingForCard(apiKey, ctx)
    return productToEntry(catalog, product, resolvedId)
  } catch {
    return productToEntry(
      catalog,
      {
        "product-name": catalog.name,
        "console-name": catalog.setName,
      },
      undefined,
    )
  }
}

export async function lookupCardById(cardId: string): Promise<MockCardEntry | null> {
  if (cardId.startsWith("poke-")) {
    return lookupCardByPokemonId(cardId.replace(/^poke-/, ""))
  }

  if (cardId.startsWith("pc-")) {
    const apiKey = process.env.PRICECHARTING_API_KEY
    if (!apiKey) return null

    const pcId = cardId.replace(/^pc-/, "")
    const { fetchPriceChartingProduct } = await import("@/lib/pricecharting")
    const product = await fetchPriceChartingProduct(apiKey, { id: pcId })

    const catalog: CatalogCard = {
      id: `pc-${pcId}`,
      name: product["product-name"] ?? "Unknown card",
      setName: product["console-name"] ?? "Unknown set",
      cardNumber: "",
      rarity: null,
      imageSmall: null,
      imageLarge: null,
    }

    return productToEntry(catalog, product, pcId)
  }

  return null
}
