import {
  getGradeQuotes,
  resolvePsa10Price,
  buildGradeQuotes,
  type GradeQuote,
  type MockCardEntry,
} from "@/lib/slab-data"

export type SlabLabCard = {
  id: string
  /** Watchlist / snapshot key — prefer this for price history APIs. */
  watchlistId: string
  name: string
  set: string
  era: string
  yearsAgo: number
  rawPrice: number
  psa10Price: number
  /** True when PSA 10 was implied from a lower grade (sold comps sparse). */
  psa10Estimated?: boolean
  psa9Price: number
  gradeQuotes: GradeQuote[]
  image: string
  cardNumber: string
}

export function gradeQuotesForSlabLabCard(card: Pick<SlabLabCard, "rawPrice" | "psa9Price" | "psa10Price" | "gradeQuotes">): GradeQuote[] {
  if (card.gradeQuotes?.length) return card.gradeQuotes
  return buildGradeQuotes(card.rawPrice, {
    ...(card.psa9Price > 0 ? { 9: { slabPrice: card.psa9Price } } : {}),
    ...(card.psa10Price > 0 ? { 10: { slabPrice: card.psa10Price } } : {}),
  })
}

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

export function toSlabLabCard(entry: MockCardEntry): SlabLabCard | null {
  const quotes = getGradeQuotes(entry)
  const { price: psa10, estimated: psa10Estimated } = resolvePsa10Price(entry)
  const psa9 = quotes.find((q) => q.grade === 9)?.slabPrice ?? 0
  const raw = Number(entry.rawPrice) || 0
  if (raw <= 0 || psa10 <= 0 || psa10 <= raw) return null

  const yearsAgo = yearsAgoFromRelease(entry.releaseDate)
  const pokemonId = entry.pokemonTcgId?.trim() || undefined

  return {
    id: pokemonId || entry.id,
    watchlistId: entry.id,
    name: entry.cardName,
    set: entry.setName,
    era: eraFromYears(yearsAgo),
    yearsAgo,
    rawPrice: raw,
    psa10Price: Math.round(psa10 * 100) / 100,
    psa10Estimated,
    psa9Price: psa9,
    gradeQuotes: quotes,
    image: entry.imageUrl || "/placeholder.svg",
    cardNumber: entry.cardNumber || "",
  }
}
