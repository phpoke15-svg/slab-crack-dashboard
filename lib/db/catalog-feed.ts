import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { isMainlinePokemonTcg, isRecentSetRelease } from "@/lib/pokemon-tcg-filter"
import {
  buildGradeQuotes,
  normalizeCardEntry,
  type GradeQuote,
  type MockCardEntry,
  type PsaGradeNumber,
  type RecentSale,
  type SampleCounts,
} from "@/lib/slab-data"

type SlabCardRow = {
  id: string
  name: string
  set_name: string
  card_number: string
  rarity: string | null
  image_large: string | null
  release_date: string | null
}

type WatchlistRow = {
  id: string
  market_insight: string
  slab_cards: SlabCardRow | null
}

type StoredGradePrice = {
  slab_price: number
  recent_slab_sales?: RecentSale[]
}

type AnomalyRow = {
  watchlist_id: string
  raw_price: number
  slab_grade: number
  slab_price: number
  deficit: number
  percentage_savings: number
  recent_raw_sales: RecentSale[] | null
  recent_slab_sales: RecentSale[] | null
  grade_prices: Record<string, StoredGradePrice> | null
  sample_counts?: SampleCounts | null
}

function formatCardName(name: string, rarity: string | null): string {
  if (!rarity) return name
  if (name.toLowerCase().includes(rarity.toLowerCase())) return name
  return `${name} (${rarity})`
}

function gradeQuotesFromAnomaly(anomaly: AnomalyRow): GradeQuote[] {
  const rawPrice = Number(anomaly.raw_price)

  if (anomaly.grade_prices && Object.keys(anomaly.grade_prices).length > 0) {
    const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number; recentSlabSales?: RecentSale[] }>> =
      {}

    for (const [gradeKey, value] of Object.entries(anomaly.grade_prices)) {
      const grade = Number(gradeKey) as PsaGradeNumber
      if (grade !== 7 && grade !== 8 && grade !== 9 && grade !== 10) continue
      byGrade[grade] = {
        slabPrice: Number(value.slab_price),
        recentSlabSales: value.recent_slab_sales ?? [],
      }
    }

    return buildGradeQuotes(rawPrice, byGrade)
  }

  const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number; recentSlabSales?: RecentSale[] }>> =
    {}
  if (anomaly.slab_grade && anomaly.slab_price > 0) {
    byGrade[anomaly.slab_grade as PsaGradeNumber] = {
      slabPrice: Number(anomaly.slab_price),
      recentSlabSales: anomaly.recent_slab_sales ?? [],
    }
  }

  return buildGradeQuotes(rawPrice, byGrade)
}

function watchlistToEntry(row: WatchlistRow, anomaly: AnomalyRow | undefined): MockCardEntry | null {
  const card = row.slab_cards
  if (!card) return null

  const cardName = formatCardName(card.name, card.rarity)
  const base = {
    id: row.id,
    pokemonTcgId: card.id,
    cardName,
    setName: card.set_name,
    cardNumber: card.card_number,
    imageUrl:
      card.image_large ??
      "https://placehold.co/150x210",
    marketInsight: row.market_insight,
    releaseDate: card.release_date ?? undefined,
  }

  if (anomaly) {
    const gradeQuotes = gradeQuotesFromAnomaly(anomaly)
    return normalizeCardEntry({
      ...base,
      rawPrice: Number(anomaly.raw_price),
      slabGrade: anomaly.slab_grade,
      slabPrice: Number(anomaly.slab_price),
      deficit: Number(anomaly.deficit),
      percentageSavings: anomaly.percentage_savings,
      gradeQuotes,
      recentRawSales: anomaly.recent_raw_sales ?? [],
      recentSlabSales: anomaly.recent_slab_sales ?? [],
      sampleCounts: anomaly.sample_counts ?? undefined,
      hasPricing: true,
    })
  }

  return normalizeCardEntry({
    ...base,
    rawPrice: 0,
    slabGrade: 9,
    slabPrice: 0,
    deficit: 0,
    percentageSavings: 0,
    hasPricing: false,
  })
}

export async function getCatalogFeedFromDb(): Promise<MockCardEntry[]> {
  const supabase = createAdminClient()

  const { data: watchlistRows, error: watchlistError } = await supabase
    .from("slab_watchlist_cards")
    .select(
      `
        id,
        market_insight,
        slab_cards (
          id,
          name,
          set_name,
          card_number,
          rarity,
          image_large,
          release_date
        )
      `,
    )

  if (watchlistError) throw new Error(`Failed to load catalog: ${watchlistError.message}`)

  let anomalyRows: AnomalyRow[] | null = null
  let anomalyError: { message: string } | null = null

  const withSampleCounts = await supabase.from("slab_anomalies").select(
    `
        watchlist_id,
        raw_price,
        slab_grade,
        slab_price,
        deficit,
        percentage_savings,
        recent_raw_sales,
        recent_slab_sales,
        grade_prices,
        sample_counts
      `,
  )

  if (withSampleCounts.error?.message?.includes("sample_counts")) {
    const withGradePrices = await supabase.from("slab_anomalies").select(
      `
        watchlist_id,
        raw_price,
        slab_grade,
        slab_price,
        deficit,
        percentage_savings,
        recent_raw_sales,
        recent_slab_sales,
        grade_prices
      `,
    )

    if (withGradePrices.error?.message?.includes("grade_prices")) {
      const withoutGradePrices = await supabase.from("slab_anomalies").select(
        `
        watchlist_id,
        raw_price,
        slab_grade,
        slab_price,
        deficit,
        percentage_savings,
        recent_raw_sales,
        recent_slab_sales
      `,
      )
      anomalyRows = (withoutGradePrices.data ?? []) as AnomalyRow[]
      anomalyError = withoutGradePrices.error
    } else {
      anomalyRows = (withGradePrices.data ?? []) as AnomalyRow[]
      anomalyError = withGradePrices.error
    }
  } else if (withSampleCounts.error?.message?.includes("grade_prices")) {
    const withoutGradePrices = await supabase.from("slab_anomalies").select(
      `
        watchlist_id,
        raw_price,
        slab_grade,
        slab_price,
        deficit,
        percentage_savings,
        recent_raw_sales,
        recent_slab_sales
      `,
    )
    anomalyRows = (withoutGradePrices.data ?? []) as AnomalyRow[]
    anomalyError = withoutGradePrices.error
  } else {
    anomalyRows = (withSampleCounts.data ?? []) as AnomalyRow[]
    anomalyError = withSampleCounts.error
  }

  if (anomalyError) throw new Error(`Failed to load anomalies: ${anomalyError.message}`)

  const anomalyByWatchlist = new Map(
    ((anomalyRows ?? []) as AnomalyRow[]).map((row) => [row.watchlist_id, row]),
  )

  return ((watchlistRows ?? []) as WatchlistRow[])
    .filter((row) => {
      const card = row.slab_cards
      if (!card) return false
      return (
        isMainlinePokemonTcg({ setName: card.set_name, genre: "Pokemon Card", productName: card.name }) &&
        isRecentSetRelease(card.release_date)
      )
    })
    .map((row) => watchlistToEntry(row, anomalyByWatchlist.get(row.id)))
    .filter((entry): entry is MockCardEntry => entry !== null)
    .sort((a, b) => {
      const aDiscovered = a.id.startsWith("pc-")
      const bDiscovered = b.id.startsWith("pc-")
      if (aDiscovered !== bDiscovered) return aDiscovered ? -1 : 1
      if (a.hasPricing !== b.hasPricing) return a.hasPricing ? -1 : 1
      if (a.hasPricing && b.hasPricing) return b.deficit - a.deficit
      return a.cardName.localeCompare(b.cardName)
    })
}

export { isSupabaseConfigured }
