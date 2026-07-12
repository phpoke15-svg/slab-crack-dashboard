import { getCatalogFeedFromDb, isSupabaseConfigured } from "@/lib/db/catalog-feed"
import { readAnomaliesCache } from "@/lib/sync-anomalies"
import mockData from "@/lib/mockData.json"
import { getGradeQuotes, normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { resolvePokemonCardImage } from "@/lib/pokemon-tcg"

export type SlabLabCard = {
  id: string
  name: string
  set: string
  era: string
  yearsAgo: number
  rawPrice: number
  psa10Price: number
  psa9Price: number
  gemRate: number
  image: string
  cardNumber: string
}

const DEFAULT_GEM_RATE = 40

function yearsAgoFromRelease(iso?: string): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / (365.25 * 24 * 60 * 60 * 1000)))
}

function eraFromYears(yearsAgo: number): string {
  if (yearsAgo <= 3) return "SV"
  if (yearsAgo <= 6) return "SWSH"
  if (yearsAgo <= 10) return "SM"
  return "Vintage"
}

function isPokemonTcgFront(url: string): boolean {
  return /images\.pokemontcg\.io/i.test(url)
}

/** Rough gem-rate proxy from PSA 9 vs 10 sold-comp mix when available. */
export function estimateGemRate(entry: MockCardEntry): number {
  const sc = entry.sampleCounts
  if (!sc) return DEFAULT_GEM_RATE
  const psa9 = Number(sc.psa9) || 0
  const psa10 = Number(sc.psa10) || 0
  const high = psa9 + psa10
  if (high < 8 || psa10 <= 0) return DEFAULT_GEM_RATE
  return Math.round(Math.min(85, Math.max(10, (100 * psa10) / high)))
}

export function toSlabLabCard(entry: MockCardEntry): SlabLabCard | null {
  const quotes = getGradeQuotes(entry)
  const psa10 = quotes.find((q) => q.grade === 10)?.slabPrice ?? 0
  const psa9 = quotes.find((q) => q.grade === 9)?.slabPrice ?? 0
  const raw = Number(entry.rawPrice) || 0
  if (raw <= 0 || psa10 <= 0 || psa10 <= raw) return null

  const yearsAgo = yearsAgoFromRelease(entry.releaseDate)
  const pokemonId = entry.pokemonTcgId?.trim() || undefined

  return {
    id: pokemonId || entry.id,
    name: entry.cardName,
    set: entry.setName,
    era: eraFromYears(yearsAgo),
    yearsAgo,
    rawPrice: raw,
    psa10Price: psa10,
    psa9Price: psa9,
    gemRate: estimateGemRate(entry),
    image: entry.imageUrl || "/placeholder.svg",
    cardNumber: entry.cardNumber || "",
  }
}

/** Prefer official Pokémon TCG API front art over PriceCharting scans (often backs). */
async function ensureFrontArtwork(card: SlabLabCard): Promise<SlabLabCard> {
  if (isPokemonTcgFront(card.image)) {
    return { ...card, image: upgradeCardImageUrlSync(card.image) }
  }

  try {
    const hit = await resolvePokemonCardImage({
      cardName: card.name,
      setName: card.set,
      cardNumber: card.cardNumber,
      pokemonTcgId: card.id.includes("-") && !card.id.startsWith("pc-") ? card.id : undefined,
    })
    const front = hit?.imageLarge || hit?.imageSmall
    if (front) {
      return {
        ...card,
        id: hit?.id || card.id,
        image: upgradeCardImageUrlSync(front),
      }
    }
  } catch (error) {
    console.warn("[slablab] front art lookup failed:", card.name, error)
  }

  return card
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await mapper(items[index]!)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function loadNormalizedFeed(): Promise<MockCardEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const feed = await getCatalogFeedFromDb()
      if (feed.length > 0) return feed.map(normalizeCardEntry)
    } catch (error) {
      console.error("[slablab] Supabase feed failed:", error)
    }
  }

  const cached = await readAnomaliesCache()
  if (cached.length > 0) return cached.map(normalizeCardEntry)

  return (mockData as MockCardEntry[]).map(normalizeCardEntry)
}

/**
 * Top grading opportunities: PSA 10 price above raw, ranked by gross spread.
 * Caps at TOP_CARDS_LIMIT (200).
 */
export async function getSlabLabOpportunities(
  limit = TOP_CARDS_LIMIT,
): Promise<SlabLabCard[]> {
  const feed = await loadNormalizedFeed()
  const cards = feed
    .map(toSlabLabCard)
    .filter((c): c is SlabLabCard => c != null)

  cards.sort((a, b) => b.psa10Price - b.rawPrice - (a.psa10Price - a.rawPrice))
  const top = cards.slice(0, Math.max(1, limit))
  return mapWithConcurrency(top, 6, ensureFrontArtwork)
}
