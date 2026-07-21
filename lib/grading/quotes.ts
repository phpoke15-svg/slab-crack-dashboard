import {
  type GradingCompany,
  gradesForCompany,
  normalizeGradingCompany,
  type SlabGradeRef,
} from "@/lib/grading/types"
import { getGradeQuotes, type MockCardEntry } from "@/lib/slab-data"

export type ScrydexGradedPrice = {
  company: string
  grade: string
  marketPrice: number
}

export type SlabGradeQuote = {
  company: GradingCompany
  grade: string
  slabPrice: number
  deficit: number
  percentageSavings: number
  isArbitrage: boolean
}

function computeSlabQuote(rawPrice: number, slabPrice: number, ref: SlabGradeRef): SlabGradeQuote {
  if (rawPrice <= 0 || slabPrice <= 0) {
    return {
      company: ref.company,
      grade: ref.grade,
      slabPrice: 0,
      deficit: 0,
      percentageSavings: 0,
      isArbitrage: false,
    }
  }

  const deficit = rawPrice - slabPrice
  const isArbitrage = deficit > 0
  return {
    company: ref.company,
    grade: ref.grade,
    slabPrice,
    deficit: isArbitrage ? deficit : 0,
    percentageSavings: isArbitrage ? Math.round((deficit / rawPrice) * 100) : 0,
    isArbitrage,
  }
}

export function gradedRowsToPrices(rows: ScrydexGradedPrice[]): ScrydexGradedPrice[] {
  return rows
    .map((row) => ({
      company: normalizeGradingCompany(row.company),
      grade: String(row.grade).trim(),
      marketPrice: Number(row.marketPrice),
    }))
    .filter((row) => row.grade && row.marketPrice > 0)
}

export function pickGradedPrice(
  rows: ScrydexGradedPrice[],
  ref: SlabGradeRef,
): number | null {
  const row = rows.find(
    (entry) =>
      normalizeGradingCompany(entry.company) === ref.company &&
      String(entry.grade).trim() === ref.grade,
  )
  return row && row.marketPrice > 0 ? row.marketPrice : null
}

export function buildSlabQuotesForCompany(
  rawPrice: number,
  rows: ScrydexGradedPrice[],
  company: GradingCompany,
): SlabGradeQuote[] {
  const normalized = gradedRowsToPrices(rows)
  return gradesForCompany(company, normalized).map((grade) => {
    const price = pickGradedPrice(normalized, { company, grade }) ?? 0
    return computeSlabQuote(rawPrice, price, { company, grade })
  })
}

export function getBestSlabQuote(quotes: SlabGradeQuote[]): SlabGradeQuote | null {
  return (
    quotes
      .filter((quote) => quote.isArbitrage)
      .sort((a, b) => b.deficit - a.deficit)[0] ?? null
  )
}

/** Fallback PSA prices from legacy Slab Labs grade quotes when Scrydex rows are unavailable. */
export function gradedPricesFromMockCard(card: MockCardEntry): ScrydexGradedPrice[] {
  return getGradeQuotes(card)
    .filter((quote) => quote.slabPrice > 0)
    .map((quote) => ({
      company: "PSA",
      grade: String(quote.grade),
      marketPrice: quote.slabPrice,
    }))
}

/** Merge Scrydex rows with card-level fallbacks; Scrydex wins on duplicate company+grade. */
export function mergeGradedPriceRows(
  primary: ScrydexGradedPrice[],
  fallback: ScrydexGradedPrice[],
): ScrydexGradedPrice[] {
  const byKey = new Map<string, ScrydexGradedPrice>()
  for (const row of gradedRowsToPrices(fallback)) {
    byKey.set(`${row.company}|${row.grade}`, row)
  }
  for (const row of gradedRowsToPrices(primary)) {
    byKey.set(`${row.company}|${row.grade}`, row)
  }
  return [...byKey.values()]
}

export function resolveGradedPricesForCard(
  gradedPrices: ScrydexGradedPrice[] | undefined,
  card: MockCardEntry,
): ScrydexGradedPrice[] {
  return mergeGradedPriceRows(gradedPrices ?? [], gradedPricesFromMockCard(card))
}

export function gradedRowsFromScrydexBundle(
  graded: Array<{ company?: string | null; grade?: string | null; market_price?: number | null; variant?: string | null }>,
): ScrydexGradedPrice[] {
  return graded
    .filter((row) => (row.variant ?? "normal") === "normal")
    .map((row) => ({
      company: String(row.company ?? ""),
      grade: String(row.grade ?? ""),
      marketPrice: Number(row.market_price ?? 0),
    }))
    .filter((row) => row.company && row.grade && row.marketPrice > 0)
}
