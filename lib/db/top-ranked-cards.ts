import { getCatalogFeedFromDb, isSupabaseConfigured } from "@/lib/db/catalog-feed"
import { readAnomaliesCache } from "@/lib/sync-anomalies"
import mockData from "@/lib/mockData.json"
import {
  buildGradeQuotes,
  normalizeCardEntry,
  type MockCardEntry,
} from "@/lib/slab-data"
import { getSlabLabOpportunities } from "@/lib/slablab"
import { toSlabLabCard, type SlabLabCard } from "@/lib/slablab-card"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"
import { createAdminClient } from "@/lib/supabase/server"

type RankedCardRow = {
  id: string
  name: string
  set_name: string
  set_id: string
  number: string
  rarity: string | null
  image_url: string | null
  scrydex_id: string | null
  current_price_raw: number | null
  current_price_psa10: number | null
  price_updated_at: string | null
}

function pokemonTcgIdFromRow(row: RankedCardRow): string {
  if (row.id.startsWith("poke-")) return row.id.slice("poke-".length)
  if (row.scrydex_id) return row.scrydex_id
  return row.id
}

export function rankedCardRowToMockEntry(row: RankedCardRow): MockCardEntry | null {
  const raw = Number(row.current_price_raw) || 0
  const psa10 = Number(row.current_price_psa10) || 0
  if (raw <= 0 || psa10 <= 0) return null

  const deficit = Math.max(0, psa10 - raw)
  const gradeQuotes = buildGradeQuotes(raw, {
    10: { slabPrice: psa10, recentSlabSales: [] },
  })

  return normalizeCardEntry({
    id: row.id.startsWith("poke-") ? row.id : `poke-${pokemonTcgIdFromRow(row)}`,
    pokemonTcgId: pokemonTcgIdFromRow(row),
    cardName: row.name,
    setName: row.set_name,
    cardNumber: row.number,
    imageUrl: row.image_url ?? "/placeholder.svg",
    rawPrice: raw,
    slabGrade: 10,
    slabPrice: psa10,
    deficit,
    percentageSavings: psa10 > 0 ? (deficit / psa10) * 100 : 0,
    gradeQuotes,
    hasPricing: true,
    marketInsight: "Top-ranked card from local catalog (Scrydex denormalized prices).",
  })
}

async function queryRankedCardsFromDb(
  mode: "graded_value" | "roi_spread",
  limit: number,
): Promise<RankedCardRow[]> {
  if (!isSupabaseConfigured()) return []

  const supabase = createAdminClient()
  const fetchLimit = Math.min(Math.max(limit * 3, limit), 300)

  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, name, set_name, set_id, number, rarity, image_url, scrydex_id, current_price_raw, current_price_psa10, price_updated_at",
    )
    .not("current_price_psa10", "is", null)
    .gt("current_price_psa10", 0)
    .order("current_price_psa10", { ascending: false, nullsFirst: false })
    .limit(fetchLimit)

  if (error?.code === "42703" || error?.code === "42P01") return []
  if (error) throw error

  let rows = (data ?? []) as RankedCardRow[]

  if (mode === "roi_spread") {
    rows = rows
      .filter((row) => {
        const raw = Number(row.current_price_raw) || 0
        const psa10 = Number(row.current_price_psa10) || 0
        return raw > 0 && psa10 > raw
      })
      .sort((a, b) => {
        const spreadA = Number(a.current_price_psa10) - Number(a.current_price_raw)
        const spreadB = Number(b.current_price_psa10) - Number(b.current_price_raw)
        return spreadB - spreadA
      })
  }

  return rows.slice(0, limit)
}

async function loadLegacyFeed(limit: number): Promise<MockCardEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const feed = await getCatalogFeedFromDb()
      if (feed.length > 0) return feed.map(normalizeCardEntry).slice(0, limit)
    } catch (error) {
      console.warn("[top-ranked-cards] legacy feed failed:", error)
    }
  }

  const cached = await readAnomaliesCache()
  if (cached.length > 0) return cached.map(normalizeCardEntry).slice(0, limit)

  return (mockData as MockCardEntry[]).map(normalizeCardEntry).slice(0, limit)
}

/** Top SlabCrack cards ranked by PSA 10 market value (local `public.cards`). */
export async function getTopSlabCrackCards(limit = TOP_CARDS_LIMIT): Promise<MockCardEntry[]> {
  try {
    const rows = await queryRankedCardsFromDb("graded_value", limit)
    const entries = rows
      .map(rankedCardRowToMockEntry)
      .filter((entry): entry is MockCardEntry => entry != null)
      .sort((a, b) => b.slabPrice - a.slabPrice)

    if (entries.length >= Math.min(limit, 10)) return entries.slice(0, limit)
  } catch (error) {
    console.warn("[top-ranked-cards] SlabCrack DB query failed:", error)
  }

  const legacy = await loadLegacyFeed(limit * 2)
  return legacy
    .filter((card) => card.hasPricing !== false && card.deficit > 0)
    .sort((a, b) => b.slabPrice - a.slabPrice)
    .slice(0, limit)
}

/** Top SlabIt cards ranked by PSA 10 minus raw spread (local `public.cards`). */
export async function getTopSlabItCards(limit = TOP_CARDS_LIMIT): Promise<SlabLabCard[]> {
  try {
    const rows = await queryRankedCardsFromDb("roi_spread", limit)
    const entries = rows
      .map(rankedCardRowToMockEntry)
      .filter((entry): entry is MockCardEntry => entry != null)

    const cards = entries.map(toSlabLabCard).filter((card): card is SlabLabCard => card != null)
    if (cards.length >= Math.min(limit, 10)) {
      return cards
        .sort((a, b) => b.psa10Price - b.rawPrice - (a.psa10Price - a.rawPrice))
        .slice(0, limit)
    }
  } catch (error) {
    console.warn("[top-ranked-cards] SlabIt DB query failed:", error)
  }

  return getSlabLabOpportunities(limit)
}
