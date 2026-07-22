import { getScrydexCardPriceRowsForIds } from "@/lib/scrydex/price-adapter"
import { isScrydexConfigured } from "@/lib/scrydex/constants"
import { buildGradeQuotes, normalizeCardEntry, type MockCardEntry, type RecentSale } from "@/lib/slab-data"

function gradeQuotesFromPriceRow(
  rawPrice: number,
  row: {
    psa7_price?: number | null
    psa8_price?: number | null
    psa9_price?: number | null
    psa10_price?: number | null
  },
) {
  const byGrade: Partial<
    Record<7 | 8 | 9 | 10, { slabPrice: number; recentSlabSales: RecentSale[] }>
  > = {}

  if (row.psa7_price && row.psa7_price > 0) {
    byGrade[7] = { slabPrice: row.psa7_price, recentSlabSales: [] }
  }
  if (row.psa8_price && row.psa8_price > 0) {
    byGrade[8] = { slabPrice: row.psa8_price, recentSlabSales: [] }
  }
  if (row.psa9_price && row.psa9_price > 0) {
    byGrade[9] = { slabPrice: row.psa9_price, recentSlabSales: [] }
  }
  if (row.psa10_price && row.psa10_price > 0) {
    byGrade[10] = { slabPrice: row.psa10_price, recentSlabSales: [] }
  }

  if (Object.keys(byGrade).length === 0) return null
  return buildGradeQuotes(rawPrice, byGrade)
}

/** Merge PSA 7–10 rows from the Scrydex cache into Slab Labs card entries. */
export async function enrichMockEntriesWithScrydexGrades(
  entries: MockCardEntry[],
): Promise<MockCardEntry[]> {
  if (!isScrydexConfigured() || entries.length === 0) return entries

  const priceRows = await getScrydexCardPriceRowsForIds(entries.map((entry) => entry.id))
  if (priceRows.size === 0) return entries

  return entries.map((entry) => {
    const row = priceRows.get(entry.id)
    if (!row) return entry

    const gradeQuotes = gradeQuotesFromPriceRow(entry.rawPrice, row)
    if (!gradeQuotes?.length) return entry

    const psa10 = row.psa10_price ?? entry.slabPrice

    return normalizeCardEntry({
      ...entry,
      rawPrice: row.raw_price && row.raw_price > 0 ? row.raw_price : entry.rawPrice,
      slabPrice: psa10 && psa10 > 0 ? psa10 : entry.slabPrice,
      gradeQuotes,
      hasPricing: entry.hasPricing !== false,
    })
  })
}
