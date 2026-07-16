import { readFile, writeFile } from "fs/promises"
import path from "path"
import watchlistConfig from "@/lib/watchlist-config.json"
import fallbackData from "@/lib/mockData.json"
import {
  extractCardPrices,
  findBestArbitrage,
  formatArbitrageAlert,
  resolvePriceChartingForCard,
} from "@/lib/pricecharting"
import {
  buildGradeQuotesFromPrices,
  getBestGradeQuote,
  normalizeCardEntry,
  type MockCardEntry,
} from "@/lib/slab-data"
import { upsertAnomaliesToDb, getAnomaliesFromDb, isSupabaseConfigured } from "@/lib/db/anomalies"
import { appendPriceSnapshots } from "@/lib/db/price-snapshots"
import { appendSaleEventsFromEntries } from "@/lib/db/sale-events"
import { getWatchlistFromDb, updatePriceChartingId } from "@/lib/db/watchlist"
import {
  defaultEbayQueries,
  fetchCardPricesFromEbaySold,
  findArbitrageFromEbaySold,
  formatArbitrageAlert as formatEbayAlert,
} from "@/lib/ebay-sold"

export interface WatchlistCard {
  id: string
  priceChartingId?: string
  pokemonTcgId?: string
  searchQuery?: string
  ebayQueries?: {
    raw: string
    psa7?: string
    psa8?: string
    psa9?: string
    psa10?: string
  }
  cardName: string
  setName: string
  cardNumber: string
  imageUrl: string
  marketInsight: string
}

export interface SyncResult {
  anomalies: MockCardEntry[]
  alerts: string[]
  syncedAt: string
  source: "pricecharting" | "ebay" | "cache" | "fallback"
}

const CACHE_PATH = path.join(process.cwd(), "data", "anomalies-cache.json")

async function loadWatchlist(): Promise<WatchlistCard[]> {
  if (isSupabaseConfigured()) {
    try {
      const fromDb = await getWatchlistFromDb()
      if (fromDb.length > 0) return fromDb
    } catch (error) {
      console.warn("[sync] Could not load watchlist from DB, using JSON fallback:", error)
    }
  }
  return watchlistConfig as WatchlistCard[]
}

export async function readAnomaliesCache(): Promise<MockCardEntry[]> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8")
    return JSON.parse(raw) as MockCardEntry[]
  } catch {
    return fallbackData as MockCardEntry[]
  }
}

export async function writeAnomaliesCache(anomalies: MockCardEntry[]): Promise<void> {
  await writeFile(CACHE_PATH, `${JSON.stringify(anomalies, null, 2)}\n`, "utf-8")

  if (isSupabaseConfigured()) {
    try {
      await upsertAnomaliesToDb(anomalies)
    } catch (error) {
      console.error("[sync] Supabase upsert failed:", error)
    }
    try {
      await appendPriceSnapshots(anomalies)
    } catch (error) {
      console.error("[sync] Price snapshot upsert failed:", error)
    }
    try {
      await appendSaleEventsFromEntries(anomalies)
    } catch (error) {
      console.error("[sync] Sale event upsert failed:", error)
    }
  }
}

export async function syncAnomaliesFromPriceCharting(apiKey: string): Promise<SyncResult> {
  const watchlist = await loadWatchlist()
  console.log(`[sync] PriceCharting: processing ${watchlist.length} cards...`)
  const anomalies: MockCardEntry[] = []
  const alerts: string[] = []
  let priced = 0
  let skipped = 0

  for (const card of watchlist) {
    try {
      const { product, resolvedId } = await resolvePriceChartingForCard(apiKey, {
        priceChartingId: card.priceChartingId,
        searchQuery: card.searchQuery,
        cardName: card.cardName,
        setName: card.setName,
        cardNumber: card.cardNumber,
      })

      if (resolvedId && resolvedId !== card.priceChartingId && isSupabaseConfigured()) {
        try {
          await updatePriceChartingId(card.id, resolvedId)
        } catch (error) {
          console.warn(`[sync] Could not save PriceCharting id for ${card.cardName}:`, error)
        }
      }

      const { rawPrice, grades } = extractCardPrices(product)
      if (rawPrice <= 0) {
        console.warn(`[sync] No raw price for ${card.cardName} (PC id ${resolvedId ?? product.id ?? "?"})`)
        skipped += 1
        await new Promise((resolve) => setTimeout(resolve, 1100))
        continue
      }

      const gradeQuotes = buildGradeQuotesFromPrices(rawPrice, grades)
      const arbitrage = findBestArbitrage(rawPrice, grades)
      if (arbitrage) alerts.push(formatArbitrageAlert(card.cardName, arbitrage))

      const best = getBestGradeQuote(gradeQuotes)

      anomalies.push(
        normalizeCardEntry({
          id: card.id,
          cardName: card.cardName,
          setName: card.setName,
          cardNumber: card.cardNumber,
          imageUrl: card.imageUrl,
          rawPrice,
          slabGrade: best?.grade ?? arbitrage?.slabGrade ?? 9,
          slabPrice: best?.slabPrice ?? arbitrage?.slabPrice ?? 0,
          deficit: best?.deficit ?? 0,
          percentageSavings: best?.percentageSavings ?? 0,
          gradeQuotes,
          marketInsight: card.marketInsight,
          hasPricing: true,
        }),
      )
      priced += 1
    } catch (error) {
      skipped += 1
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[sync] Skipped ${card.cardName}: ${message}`)
    }

    // PriceCharting rate limit: 1 req/sec
    await new Promise((resolve) => setTimeout(resolve, 1100))
  }

  console.log(`[sync] PriceCharting done: ${priced} priced, ${skipped} skipped`)

  if (anomalies.length > 0) {
    await writeAnomaliesCache(anomalies)
  }

  return {
    anomalies:
      anomalies.length > 0
        ? anomalies
        : isSupabaseConfigured()
          ? await getAnomaliesFromDb().catch(() => readAnomaliesCache())
          : await readAnomaliesCache(),
    alerts,
    syncedAt: new Date().toISOString(),
    source: anomalies.length > 0 ? "pricecharting" : "cache",
  }
}

export async function syncAnomaliesFromEbaySold(apiKey: string): Promise<SyncResult> {
  const watchlist = await loadWatchlist()
  console.log(`[sync] Processing ${watchlist.length} watchlist cards...`)
  const anomalies: MockCardEntry[] = []
  const alerts: string[] = []

  for (const card of watchlist) {
    const queries = card.ebayQueries ?? defaultEbayQueries(card)
    const { rawPrice, grades, sampleCounts, recentRawSales, recentByGrade } =
      await fetchCardPricesFromEbaySold(apiKey, queries)

    if (rawPrice <= 0) {
      console.warn(`[eBay] No raw sold comps for ${card.cardName} (${sampleCounts.raw} matches)`)
      continue
    }

    const gradeQuotes = buildGradeQuotesFromPrices(rawPrice, grades, recentByGrade)
    const arbitrage = findArbitrageFromEbaySold(rawPrice, grades)
    if (arbitrage) alerts.push(formatEbayAlert(card.cardName, arbitrage))

    const best = getBestGradeQuote(gradeQuotes)

    anomalies.push(
      normalizeCardEntry({
        id: card.id,
        cardName: card.cardName,
        setName: card.setName,
        cardNumber: card.cardNumber,
        imageUrl: card.imageUrl,
        rawPrice,
        slabGrade: best?.grade ?? arbitrage?.slabGrade ?? 9,
        slabPrice: best?.slabPrice ?? arbitrage?.slabPrice ?? 0,
        deficit: best?.deficit ?? 0,
        percentageSavings: best?.percentageSavings ?? 0,
        gradeQuotes,
        marketInsight: `${card.marketInsight} (Prices from eBay sold comps, last 30 days.)`,
        recentRawSales,
        recentSlabSales: best?.recentSlabSales ?? recentByGrade[best?.grade ?? 9] ?? [],
        sampleCounts,
        hasPricing: true,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 1100))
  }

  if (anomalies.length > 0) {
    await writeAnomaliesCache(anomalies)
  }

  return {
    anomalies:
      anomalies.length > 0
        ? anomalies
        : isSupabaseConfigured()
          ? await getAnomaliesFromDb().catch(() => readAnomaliesCache())
          : await readAnomaliesCache(),
    alerts,
    syncedAt: new Date().toISOString(),
    source: anomalies.length > 0 ? "ebay" : "cache",
  }
}

export async function syncAnomalies(): Promise<SyncResult> {
  const source = process.env.PRICE_SOURCE ?? "ebay"
  if (source === "ebay") {
    const key = process.env.EBAY_SOLD_API_KEY
    if (!key) throw new Error("EBAY_SOLD_API_KEY is not configured")
    return syncAnomaliesFromEbaySold(key)
  }

  const key = process.env.PRICECHARTING_API_KEY
  if (!key) throw new Error("PRICECHARTING_API_KEY is not configured")
  return syncAnomaliesFromPriceCharting(key)
}
