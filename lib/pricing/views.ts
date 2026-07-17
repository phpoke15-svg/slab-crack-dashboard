import {
  buildGradeQuotes,
  getBestGradeQuote,
  isPsaSlabGrade,
  normalizeCardEntry,
  type MockCardEntry,
  type PsaGradeNumber,
} from "@/lib/slab-data"
import type { CardPriceRow } from "@/lib/pricing/types"

export function cardPriceRowToGradeMap(row: CardPriceRow): Partial<Record<PsaGradeNumber, { slabPrice: number }>> {
  const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number }>> = {}
  const pairs: Array<[PsaGradeNumber, number | null]> = [
    [7, row.psa7_price],
    [8, row.psa8_price],
    [9, row.psa9_price],
    [10, row.psa10_price],
  ]

  for (const [grade, price] of pairs) {
    if (price != null && price > 0 && isPsaSlabGrade(grade)) {
      byGrade[grade] = { slabPrice: price }
    }
  }

  return byGrade
}

export function cardPriceRowToMockEntry(
  row: CardPriceRow,
  metadata?: {
    id?: string
    cardName?: string
    setName?: string
    cardNumber?: string
    imageUrl?: string
    marketInsight?: string
  },
): MockCardEntry {
  const rawPrice = row.raw_price ?? 0
  const gradeQuotes = buildGradeQuotes(rawPrice, cardPriceRowToGradeMap(row))
  const best = getBestGradeQuote(gradeQuotes)

  return normalizeCardEntry({
    id: metadata?.id ?? row.card_id,
    cardName: metadata?.cardName ?? row.card_name ?? "Unknown card",
    setName: metadata?.setName ?? row.card_set ?? "Unknown set",
    cardNumber: metadata?.cardNumber ?? row.card_number ?? "",
    imageUrl: metadata?.imageUrl ?? "",
    rawPrice,
    slabGrade: best?.grade ?? 8,
    slabPrice: best?.slabPrice ?? 0,
    deficit: best?.deficit ?? 0,
    percentageSavings: best?.percentageSavings ?? 0,
    marketInsight:
      metadata?.marketInsight ??
      (rawPrice > 0
        ? "Cached market prices (updated daily)."
        : "Price pending — next sync will refresh."),
    gradeQuotes,
    hasPricing: rawPrice > 0 || gradeQuotes.some((q) => q.slabPrice > 0),
  })
}

export function toBinderRawPrice(row: CardPriceRow | null | undefined): number {
  if (!row?.raw_price || row.raw_price <= 0) return 0
  return row.raw_price
}

export function toSlabAnomalyPrices(row: CardPriceRow | null | undefined): {
  rawPrice: number
  psa10Price: number
  gradePrices: Record<string, number>
} {
  if (!row) {
    return { rawPrice: 0, psa10Price: 0, gradePrices: {} }
  }

  const gradePrices: Record<string, number> = {}
  if (row.psa7_price && row.psa7_price > 0) gradePrices["7"] = row.psa7_price
  if (row.psa8_price && row.psa8_price > 0) gradePrices["8"] = row.psa8_price
  if (row.psa9_price && row.psa9_price > 0) gradePrices["9"] = row.psa9_price
  if (row.psa10_price && row.psa10_price > 0) gradePrices["10"] = row.psa10_price

  return {
    rawPrice: row.raw_price ?? 0,
    psa10Price: row.psa10_price ?? 0,
    gradePrices,
  }
}

export function mergeCachedRawPrices(
  primary: Map<string, number>,
  fallback: Map<string, number>,
): Map<string, number> {
  const merged = new Map(primary)
  for (const [cardId, price] of fallback) {
    if (price > 0 && !merged.has(cardId)) {
      merged.set(cardId, price)
    }
  }
  return merged
}
