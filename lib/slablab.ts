import { getCatalogFeedFromDb, isSupabaseConfigured } from "@/lib/db/catalog-feed"
import { readAnomaliesCache } from "@/lib/sync-anomalies"
import mockData from "@/lib/mockData.json"
import { normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { toSlabLabCard, type SlabLabCard } from "@/lib/slablab-card"

export type { SlabLabCard }
export { toSlabLabCard }

function isPokemonTcgFront(url: string): boolean {
  return /images\.pokemontcg\.io/i.test(url)
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
 *
 * Artwork enrichment is sync-only here so the feed stays fast — client CardImage
 * can still upgrade fronts without blocking /api/slablab.
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

  return top.map((card) => ({
    ...card,
    image: isPokemonTcgFront(card.image)
      ? upgradeCardImageUrlSync(card.image)
      : card.image,
  }))
}
