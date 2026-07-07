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

/** User-facing set nicknames → Pokémon TCG API set.id */
const SET_HINT_IDS: Record<string, string> = {
  "151": "sv3pt5",
  pokemon151: "sv3pt5",
  sv151: "sv3pt5",
}

function resolveSetIdForHint(hint: string): string | null {
  return SET_HINT_IDS[normalizeToken(hint)] ?? null
}

function cardMatchesHints(card: CatalogCard, hints: string[]): boolean {
  const setNorm = normalizeToken(card.setName)
  const numNorm = normalizeToken(card.cardNumber.split("/")[0] ?? "")
  const nameNorm = normalizeToken(card.name)

  return hints.every(
    (hint) => setNorm.includes(hint) || numNorm.includes(hint) || nameNorm.includes(hint),
  )
}

async function fetchCardsForHints(
  name: string,
  hints: string[],
  limit: number,
): Promise<CatalogCard[]> {
  const escapedName = escapeLucene(name)
  const normalizedHints = hints.map(normalizeToken).filter(Boolean)
  const queries: string[] = []
  const seenQueries = new Set<string>()

  const addQuery = (query: string) => {
    if (!query || seenQueries.has(query)) return
    seenQueries.add(query)
    queries.push(query)
  }

  for (const hint of hints) {
    const setId = resolveSetIdForHint(hint)
    if (setId) {
      addQuery(`name:${escapedName} set.id:${setId}`)
    } else {
      addQuery(`name:${escapedName} set.name:"${escapeLucene(hint)}"`)
    }
  }

  for (const hint of normalizedHints) {
    if (/^\d+$/.test(hint) && !resolveSetIdForHint(hint)) {
      addQuery(`name:${escapedName} number:${hint}`)
    }
  }

  addQuery(`name:${escapedName}`)

  for (const query of queries) {
    try {
      const pageSize = query === `name:${escapedName}` ? Math.min(100, limit * 8) : limit
      const cards = await fetchPokemonCardsByQuery(query, pageSize)
      const filtered =
        normalizedHints.length > 0
          ? cards.filter((card) => cardMatchesHints(card, normalizedHints))
          : cards
      if (filtered.length > 0) return filtered
    } catch {
      /* try next query strategy */
    }
  }

  return []
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
  const hints = parts.slice(1)

  if (hints.length > 0) {
    const cards = await fetchCardsForHints(parts[0], hints, limit)
    return cards.slice(0, limit).map(catalogToSearchHit)
  }

  const cards = await fetchPokemonCardsByQuery(buildUserSearchQuery(trimmed), limit)
  return cards.slice(0, limit).map(catalogToSearchHit)
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
