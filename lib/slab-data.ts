import mockData from "@/lib/mockData.json"

export type Grade = "PSA 7" | "PSA 8" | "PSA 9" | "PSA 10"

export type Feed = "top" | "watchlist"

export interface RecentSale {
  title: string
  price: number
  shipping: number
  total: number
  soldDate: string
  url?: string
}

export interface MockCardEntry {
  id: string
  cardName: string
  setName: string
  cardNumber: string
  imageUrl: string
  rawPrice: number
  /** Best arbitrage grade — kept for sorting and legacy consumers. */
  slabGrade: number
  slabPrice: number
  deficit: number
  percentageSavings: number
  marketInsight: string
  /** PSA 7 / 8 / 9 / 10 slab comps for this card. */
  gradeQuotes?: GradeQuote[]
  recentRawSales?: RecentSale[]
  recentSlabSales?: RecentSale[]
  /** False when the card is tracked but price sync has not run yet. */
  hasPricing?: boolean
  /** ISO date from PriceCharting set release (YYYY-MM-DD). */
  releaseDate?: string
}

export const PSA_GRADE_NUMBERS = [7, 8, 9, 10] as const
export type PsaGradeNumber = (typeof PSA_GRADE_NUMBERS)[number]

export function isPsaSlabGrade(grade: number): grade is PsaGradeNumber {
  return (PSA_GRADE_NUMBERS as readonly number[]).includes(grade)
}

export interface GradeQuote {
  grade: PsaGradeNumber
  slabPrice: number
  deficit: number
  percentageSavings: number
  isArbitrage: boolean
  recentSlabSales?: RecentSale[]
}

export function computeGradeQuote(
  rawPrice: number,
  slabPrice: number,
  grade: PsaGradeNumber,
): GradeQuote {
  if (rawPrice <= 0 || slabPrice <= 0) {
    return { grade, slabPrice: 0, deficit: 0, percentageSavings: 0, isArbitrage: false }
  }

  const deficit = rawPrice - slabPrice
  const isArbitrage = deficit > 0
  return {
    grade,
    slabPrice,
    deficit: isArbitrage ? deficit : 0,
    percentageSavings: isArbitrage ? Math.round((deficit / rawPrice) * 100) : 0,
    isArbitrage,
  }
}

export function buildGradeQuotes(
  rawPrice: number,
  byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number; recentSlabSales?: RecentSale[] }>>,
): GradeQuote[] {
  return PSA_GRADE_NUMBERS.map((grade) => {
    const data = byGrade[grade]
    const quote = computeGradeQuote(rawPrice, data?.slabPrice ?? 0, grade)
    return { ...quote, recentSlabSales: data?.recentSlabSales }
  })
}

export function getBestGradeQuote(quotes: GradeQuote[]): GradeQuote | null {
  return (
    quotes
      .filter((quote) => quote.isArbitrage)
      .sort((a, b) => b.deficit - a.deficit)[0] ?? null
  )
}

export function getGradeQuotes(entry: MockCardEntry): GradeQuote[] {
  if (entry.gradeQuotes?.length) return entry.gradeQuotes

  const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number; recentSlabSales?: RecentSale[] }>> =
    {}
  if (entry.slabGrade && entry.slabPrice > 0) {
    byGrade[entry.slabGrade as PsaGradeNumber] = {
      slabPrice: entry.slabPrice,
      recentSlabSales: entry.recentSlabSales,
    }
  }

  return buildGradeQuotes(entry.rawPrice, byGrade)
}

export function normalizeCardEntry(entry: MockCardEntry): MockCardEntry {
  const gradeQuotes = getGradeQuotes(entry)
  const hasAnySlabPrice = gradeQuotes.some((quote) => quote.slabPrice > 0)
  const priced = entry.hasPricing !== false && (entry.rawPrice > 0 || hasAnySlabPrice)
  const best = getBestGradeQuote(gradeQuotes)

  return {
    ...entry,
    gradeQuotes,
    hasPricing: priced,
    slabGrade: best?.grade ?? entry.slabGrade,
    slabPrice: best?.slabPrice ?? entry.slabPrice,
    deficit: best?.deficit ?? 0,
    percentageSavings: best?.percentageSavings ?? 0,
    recentSlabSales: best?.recentSlabSales ?? entry.recentSlabSales,
  }
}

export function buildGradeQuotesFromPrices(
  rawPrice: number,
  grades: { grade: number; price: number }[],
  recentByGrade?: Partial<Record<number, RecentSale[]>>,
): GradeQuote[] {
  const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number; recentSlabSales?: RecentSale[] }>> =
    {}

  for (const { grade, price } of grades) {
    if (isPsaSlabGrade(grade)) {
      byGrade[grade] = {
        slabPrice: price,
        recentSlabSales: recentByGrade?.[grade],
      }
    }
  }

  return buildGradeQuotes(rawPrice, byGrade)
}

export interface SlabCard {
  id: string
  name: string
  number: string
  set: string
  rarity: string
  image: string
  rawValue: number
  slabValue: number
  grade: Grade
  feeds: Feed[]
  insight: string
}

function parseCardName(cardName: string): { name: string; rarity: string } {
  const match = cardName.match(/^(.+?)\s+\((.+)\)$/)
  if (match) return { name: match[1], rarity: match[2] }
  return { name: cardName, rarity: "Unknown" }
}

function toGrade(slabGrade: number): Grade {
  return `PSA ${slabGrade}` as Grade
}

function toSlabCard(entry: MockCardEntry): SlabCard {
  const { name, rarity } = parseCardName(entry.cardName)
  return {
    id: entry.id,
    name,
    number: entry.cardNumber,
    set: entry.setName,
    rarity,
    image: entry.imageUrl,
    rawValue: entry.rawPrice,
    slabValue: entry.slabPrice,
    grade: toGrade(entry.slabGrade),
    feeds: ["top"],
    insight: entry.marketInsight,
  }
}

export function mockEntryToSlabCard(entry: MockCardEntry): SlabCard {
  return toSlabCard(entry)
}

export const CARDS: SlabCard[] = (mockData as MockCardEntry[]).map(toSlabCard)

export function computeDeficit(card: SlabCard) {
  const diff = card.slabValue - card.rawValue
  const pct = (diff / card.rawValue) * 100
  return { diff, pct }
}

/* ---------------------------------------------------------------------------
 * Deal Intelligence
 * Deterministic, seed-based signals so values stay stable across renders
 * without bloating the dataset with hand-authored numbers.
 * ------------------------------------------------------------------------- */

function seedFrom(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 30-day history of the raw→slab deficit, trending toward today's value. */
export function getDeficitHistory(card: SlabCard, points = 30): number[] {
  const rand = mulberry32(seedFrom(card.id))
  const current = computeDeficit(card).diff
  // Start further from zero, drift toward the current deficit with noise.
  const start = current * (0.35 + rand() * 0.4)
  const series: number[] = []
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    const base = start + (current - start) * t
    const noise = (rand() - 0.5) * Math.abs(current) * 0.18
    series.push(base + noise)
  }
  series[points - 1] = current
  return series
}

/** Is the arbitrage window opening (deficit deepening) or closing? */
export function getDeficitTrend(card: SlabCard): "widening" | "closing" | "stable" {
  const h = getDeficitHistory(card)
  const recent = h[h.length - 1] - h[h.length - 8]
  if (recent < -1.5) return "widening"
  if (recent > 1.5) return "closing"
  return "stable"
}

/** PSA population report across grades for this card. */
export function getPopReport(card: SlabCard): Record<number, number> {
  const rand = mulberry32(seedFrom(card.id + "pop"))
  const scale = 6
  return {
    7: Math.round((40 + rand() * 260) * scale),
    8: Math.round((80 + rand() * 520) * scale),
    9: Math.round((160 + rand() * 900) * scale),
    10: Math.round((30 + rand() * 380) * scale),
  }
}

/** Number of recent verified sales backing the comp. */
export function getSalesCount(card: SlabCard): number {
  const rand = mulberry32(seedFrom(card.id + "sales"))
  return Math.round(3 + rand() * 44)
}

export interface Confidence {
  level: "low" | "medium" | "high"
  label: string
  sales: number
}

/** Comp confidence based on how many recent sales support the deficit. */
export function getConfidence(card: SlabCard): Confidence {
  const sales = getSalesCount(card)
  if (sales >= 25) return { level: "high", label: "High confidence", sales }
  if (sales >= 10) return { level: "medium", label: "Medium confidence", sales }
  return { level: "low", label: "Low confidence", sales }
}

/* ---------------------------------------------------------------------------
 * Regrade ROI model
 * ------------------------------------------------------------------------- */

/** Slab value multipliers relative to a PSA 10 anchor. */
export const GRADE_MULTIPLIER: Record<number, number> = {
  7: 0.18,
  8: 0.28,
  9: 0.45,
  10: 1,
}

function gradeNum(grade: Grade): number {
  return Number(grade.replace("PSA ", ""))
}

/** Implied PSA 10 value derived from the card's known grade + slab price. */
export function gradeAnchor(card: SlabCard): number {
  return card.slabValue / GRADE_MULTIPLIER[gradeNum(card.grade)]
}

/** Projected market value if the card graded at the given whole grade. */
export function projectedSlabValue(card: SlabCard, targetGrade: number): number {
  const g = Math.max(7, Math.min(10, Math.round(targetGrade)))
  return gradeAnchor(card) * GRADE_MULTIPLIER[g]
}

export interface GradingTier {
  id: string
  label: string
  fee: number
  turnaround: string
}

export const GRADING_TIERS: GradingTier[] = [
  { id: "value", label: "Value", fee: 19, turnaround: "~65 days" },
  { id: "regular", label: "Regular", fee: 39, turnaround: "~20 days" },
  { id: "express", label: "Express", fee: 79, turnaround: "~5 days" },
]

/** Shipping + supplies estimate for a single-card submission. */
export const SUBMISSION_OVERHEAD = 12

export interface RegradeROI {
  estGrade: number
  cost: number
  projectedValue: number
  netProfit: number
  roiPct: number
  profitable: boolean
}

export function computeRegradeROI(card: SlabCard, estGrade: number, fee: number): RegradeROI {
  const cost = card.rawValue + fee + SUBMISSION_OVERHEAD
  const projectedValue = projectedSlabValue(card, estGrade)
  const netProfit = projectedValue - cost
  const roiPct = (netProfit / cost) * 100
  return {
    estGrade: Math.max(7, Math.min(10, Math.round(estGrade))),
    cost,
    projectedValue,
    netProfit,
    roiPct,
    profitable: netProfit > 0,
  }
}

export const GRADES: Grade[] = ["PSA 7", "PSA 8", "PSA 9", "PSA 10"]

export const FEEDS: { id: Feed; label: string }[] = [
  { id: "top", label: "Top Deficits" },
  { id: "watchlist", label: "Watchlist" },
]
