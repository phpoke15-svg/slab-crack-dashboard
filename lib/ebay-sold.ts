/**
 * eBay sold comps — uses recent completed sales (not active asking prices).
 *
 * Default provider: SoldComps (https://sold-comps.com/docs)
 *   GET /v1/scrape?keyword=...&sortOrder=endedRecently&daysToScrape=30
 *   Authorization: Bearer sc_YOUR_KEY
 *
 * eBay's own Browse API only returns active listings. Marketplace Insights
 * (Terapeak data) requires partner approval. Sold comps APIs aggregate
 * public completed-sale data legally.
 */

import { findBestArbitrage, formatArbitrageAlert, type ArbitrageResult } from "@/lib/pricecharting"
import type { RecentSale } from "@/lib/slab-data"

export type { RecentSale }

export interface EbaySoldItem {
  title: string
  soldPrice: string
  shippingPrice?: string
  endedAt?: string
  url?: string
}

export interface EbaySoldResponse {
  keyword: string
  totalItems: number
  hasNextPage: boolean
  items: EbaySoldItem[]
}

export interface EbayGradeQueries {
  raw: string
  psa7?: string
  psa8?: string
  psa9?: string
  psa10?: string
}

const DEFAULT_BASE = "https://api.sold-comps.com"

function totalPrice(item: EbaySoldItem): number {
  const sold = parseFloat(item.soldPrice)
  const ship = parseFloat(item.shippingPrice ?? "0")
  if (!Number.isFinite(sold)) return 0
  return sold + (Number.isFinite(ship) ? ship : 0)
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function isGraded(title: string): boolean {
  return /\b(PSA|BGS|CGC|SGC|CGS)\b/i.test(title)
}

function matchesPsaGrade(title: string, grade: number): boolean {
  return new RegExp(`\\bPSA\\s*${grade}\\b`, "i").test(title)
}

/** Keep recent sold rows that match the intended grade bucket. */
export function filterSoldItems(items: EbaySoldItem[], grade: "raw" | number): EbaySoldItem[] {
  if (grade === "raw") {
    return items.filter((item) => !isGraded(item.title))
  }
  return items.filter((item) => matchesPsaGrade(item.title, grade))
}

/** Median sold price (item + shipping) from the most recent matching comps. */
export function medianSoldPrice(items: EbaySoldItem[], maxSamples = 12): number {
  const prices = items
    .slice(0, maxSamples)
    .map(totalPrice)
    .filter((p) => p > 0)
  return median(prices)
}

export function toRecentSales(items: EbaySoldItem[], limit = 40): RecentSale[] {
  return items.slice(0, limit).map((item) => ({
    title: item.title,
    price: parseFloat(item.soldPrice) || 0,
    shipping: parseFloat(item.shippingPrice ?? "0") || 0,
    total: totalPrice(item),
    soldDate: item.endedAt ?? "",
    url: item.url,
  }))
}

interface GradeCompResult {
  price: number
  count: number
  recentSales: RecentSale[]
}

async function fetchGradeComps(
  apiKey: string,
  keyword: string,
  grade: "raw" | number,
): Promise<GradeCompResult> {
  const data = await fetchEbaySoldComps(apiKey, keyword)
  const filtered = filterSoldItems(data.items ?? [], grade)
  return {
    price: medianSoldPrice(filtered),
    count: filtered.length,
    recentSales: toRecentSales(filtered, 40),
  }
}

export async function fetchEbaySoldComps(
  apiKey: string,
  keyword: string,
  options?: { baseUrl?: string; daysToScrape?: number },
): Promise<EbaySoldResponse> {
  const base = options?.baseUrl ?? process.env.EBAY_SOLD_API_BASE ?? DEFAULT_BASE
  const params = new URLSearchParams({
    keyword,
    sortOrder: "endedRecently",
    daysToScrape: String(options?.daysToScrape ?? 30),
    count: "240",
    page: "1",
  })

  const response = await fetch(`${base}/v1/scrape?${params.toString()}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`eBay sold comps HTTP ${response.status} for "${keyword}"`)
  }

  return (await response.json()) as EbaySoldResponse
}

export interface EbayCardPrices {
  rawPrice: number
  grades: { grade: number; price: number }[]
  sampleCounts: { raw: number; psa7: number; psa8: number; psa9: number; psa10: number }
  recentRawSales: RecentSale[]
  recentByGrade: Record<number, RecentSale[]>
}

function slabQuery(queries: EbayGradeQueries, grade: number): string {
  if (grade === 7 && queries.psa7) return queries.psa7
  if (grade === 8 && queries.psa8) return queries.psa8
  if (grade === 9 && queries.psa9) return queries.psa9
  if (grade === 10 && queries.psa10) return queries.psa10
  return `${queries.raw} PSA ${grade}`
}

/** Pull median recent sold prices for raw + PSA 7–10 search queries. */
export async function fetchCardPricesFromEbaySold(
  apiKey: string,
  queries: EbayGradeQueries,
): Promise<EbayCardPrices> {
  const raw = await fetchGradeComps(apiKey, queries.raw, "raw")
  await delay(1100)

  const psa7 = await fetchGradeComps(apiKey, slabQuery(queries, 7), 7)
  await delay(1100)
  const psa8 = await fetchGradeComps(apiKey, slabQuery(queries, 8), 8)
  await delay(1100)
  const psa9 = await fetchGradeComps(apiKey, slabQuery(queries, 9), 9)
  await delay(1100)
  const psa10 = await fetchGradeComps(apiKey, slabQuery(queries, 10), 10)

  return {
    rawPrice: raw.price,
    grades: [
      { grade: 7, price: psa7.price },
      { grade: 8, price: psa8.price },
      { grade: 9, price: psa9.price },
      { grade: 10, price: psa10.price },
    ],
    sampleCounts: {
      raw: raw.count,
      psa7: psa7.count,
      psa8: psa8.count,
      psa9: psa9.count,
      psa10: psa10.count,
    },
    recentRawSales: raw.recentSales,
    recentByGrade: {
      7: psa7.recentSales,
      8: psa8.recentSales,
      9: psa9.recentSales,
      10: psa10.recentSales,
    },
  }
}

/** Fetch the 5 most recent raw + slab sold comps for a single card (drawer live load). */
export async function fetchRecentSalesForCard(
  apiKey: string,
  card: { ebayQueries?: EbayGradeQueries; searchQuery?: string; cardName: string; cardNumber: string },
  slabGrade: number,
): Promise<{ recentRawSales: RecentSale[]; recentSlabSales: RecentSale[] }> {
  const queries = card.ebayQueries ?? defaultEbayQueries(card)
  const raw = await fetchGradeComps(apiKey, queries.raw, "raw")
  await delay(1100)
  const slab = await fetchGradeComps(apiKey, slabQuery(queries, slabGrade), slabGrade)
  return { recentRawSales: raw.recentSales, recentSlabSales: slab.recentSales }
}

export function findArbitrageFromEbaySold(
  rawPrice: number,
  grades: { grade: number; price: number }[],
): ArbitrageResult | null {
  return findBestArbitrage(rawPrice, grades)
}

export { formatArbitrageAlert }

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Build default eBay search queries from card metadata. */
export function defaultEbayQueries(card: {
  searchQuery?: string
  cardName: string
  cardNumber: string
}): EbayGradeQueries {
  const base =
    card.searchQuery ??
    `${card.cardName.replace(/\s+\([^)]+\)/, "")} ${card.cardNumber} pokemon`
  return {
    raw: `${base} NM`,
    psa7: `${base} PSA 7`,
    psa8: `${base} PSA 8`,
    psa9: `${base} PSA 9`,
    psa10: `${base} PSA 10`,
  }
}
