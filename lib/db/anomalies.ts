import { createAdminClient, createReadClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  buildGradeQuotes,
  getGradeQuotes,
  normalizeCardEntry,
  type MockCardEntry,
  type PsaGradeNumber,
  type RecentSale,
} from "@/lib/slab-data"

export function gradeQuotesToStored(gradeQuotes: ReturnType<typeof getGradeQuotes>) {
  return Object.fromEntries(
    gradeQuotes
      .filter((quote) => quote.slabPrice > 0)
      .map((quote) => [
        String(quote.grade),
        {
          slab_price: quote.slabPrice,
          recent_slab_sales: quote.recentSlabSales ?? [],
        },
      ]),
  )
}

type SlabCardRow = {
  id: string
  name: string
  set_name: string
  card_number: string
  rarity: string | null
  image_large: string | null
}

type AnomalyRow = {
  watchlist_id: string
  card_id: string | null
  raw_price: number
  slab_grade: number
  slab_price: number
  deficit: number
  percentage_savings: number
  recent_raw_sales: RecentSale[] | null
  recent_slab_sales: RecentSale[] | null
  grade_prices: Record<string, { slab_price: number; recent_slab_sales?: RecentSale[] }> | null
  synced_at: string
  slab_watchlist_cards: {
    id: string
    market_insight: string
    slab_cards: SlabCardRow | null
  } | null
}

function formatCardName(name: string, rarity: string | null): string {
  if (!rarity) return name
  if (name.toLowerCase().includes(rarity.toLowerCase())) return name
  return `${name} (${rarity})`
}

function gradeQuotesFromRow(row: AnomalyRow) {
  const rawPrice = Number(row.raw_price)

  if (row.grade_prices && Object.keys(row.grade_prices).length > 0) {
    const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number; recentSlabSales?: RecentSale[] }>> =
      {}
    for (const [gradeKey, value] of Object.entries(row.grade_prices)) {
      const grade = Number(gradeKey) as PsaGradeNumber
      if (grade !== 7 && grade !== 8 && grade !== 9) continue
      byGrade[grade] = {
        slabPrice: Number(value.slab_price),
        recentSlabSales: value.recent_slab_sales ?? [],
      }
    }
    return buildGradeQuotes(rawPrice, byGrade)
  }

  const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number; recentSlabSales?: RecentSale[] }>> =
    {}
  if (row.slab_grade && row.slab_price > 0) {
    byGrade[row.slab_grade as PsaGradeNumber] = {
      slabPrice: Number(row.slab_price),
      recentSlabSales: row.recent_slab_sales ?? [],
    }
  }

  return buildGradeQuotes(rawPrice, byGrade)
}

function rowToMockEntry(row: AnomalyRow): MockCardEntry | null {
  const card = row.slab_watchlist_cards?.slab_cards
  const insight = row.slab_watchlist_cards?.market_insight ?? ""

  if (!card) return null

  return normalizeCardEntry({
    id: row.watchlist_id,
    cardName: formatCardName(card.name, card.rarity),
    setName: card.set_name,
    cardNumber: card.card_number,
    imageUrl: card.image_large ?? "https://placehold.co/150x210",
    rawPrice: Number(row.raw_price),
    slabGrade: row.slab_grade,
    slabPrice: Number(row.slab_price),
    deficit: Number(row.deficit),
    percentageSavings: row.percentage_savings,
    marketInsight: insight,
    recentRawSales: row.recent_raw_sales ?? [],
    recentSlabSales: row.recent_slab_sales ?? [],
    hasPricing: true,
    gradeQuotes: gradeQuotesFromRow(row),
  })
}

export async function getAnomaliesFromDb(): Promise<MockCardEntry[]> {
  const supabase = createReadClient()

  const { data, error } = await supabase
    .from("slab_anomalies")
    .select(
      `
      watchlist_id,
      card_id,
      raw_price,
      slab_grade,
      slab_price,
      deficit,
      percentage_savings,
      recent_raw_sales,
      recent_slab_sales,
      grade_prices,
      synced_at,
      slab_watchlist_cards (
        id,
        market_insight,
        slab_cards (
          id,
          name,
          set_name,
          card_number,
          rarity,
          image_large
        )
      )
    `,
    )
    .order("deficit", { ascending: false })

  if (error) throw new Error(`Failed to read anomalies: ${error.message}`)

  return (data as AnomalyRow[])
    .map(rowToMockEntry)
    .filter((entry): entry is MockCardEntry => entry !== null)
}

export async function upsertAnomaliesToDb(entries: MockCardEntry[]): Promise<void> {
  if (entries.length === 0) return

  const supabase = createAdminClient()

  const { data: watchlistRows, error: watchlistError } = await supabase
    .from("slab_watchlist_cards")
    .select("id, card_id")

  if (watchlistError) {
    throw new Error(`Failed to load watchlist: ${watchlistError.message}`)
  }

  const cardIdByWatchlist = new Map(
    (watchlistRows ?? []).map((row) => [row.id as string, row.card_id as string | null]),
  )

  const rows = entries.map((entry) => {
    const normalized = normalizeCardEntry(entry)
    const gradeQuotes = getGradeQuotes(normalized)

    return {
      watchlist_id: normalized.id,
      card_id: cardIdByWatchlist.get(normalized.id) ?? null,
      raw_price: normalized.rawPrice,
      slab_grade: normalized.slabGrade,
      slab_price: normalized.slabPrice,
      deficit: normalized.deficit,
      percentage_savings: normalized.percentageSavings,
      recent_raw_sales: normalized.recentRawSales ?? [],
      recent_slab_sales: normalized.recentSlabSales ?? [],
      grade_prices: gradeQuotesToStored(gradeQuotes),
      synced_at: new Date().toISOString(),
    }
  })

  const { error } = await supabase.from("slab_anomalies").upsert(rows, { onConflict: "watchlist_id" })
  if (error) throw new Error(`Failed to upsert anomalies: ${error.message}`)
}

export { isSupabaseConfigured }
