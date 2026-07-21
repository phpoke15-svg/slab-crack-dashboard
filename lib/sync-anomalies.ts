import { readFile, writeFile } from "fs/promises"
import path from "path"
import watchlistConfig from "@/lib/watchlist-config.json"
import fallbackData from "@/lib/mockData.json"
import { fetchCardPricesForTarget } from "@/lib/pricing/fetch"
import { hasTcgGoApiKey } from "@/lib/pricing/provider"
import {
  buildGradeQuotesFromPrices,
  findBestArbitrage,
  formatArbitrageAlert,
  getBestGradeQuote,
  normalizeCardEntry,
  type MockCardEntry,
} from "@/lib/slab-data"
import { upsertAnomaliesToDb, getAnomaliesFromDb, isSupabaseConfigured } from "@/lib/db/anomalies"
import { appendPriceSnapshots } from "@/lib/db/price-snapshots"
import { getWatchlistFromDb } from "@/lib/db/watchlist"

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
  source: "tcggo" | "cache" | "fallback"
}

const CACHE_PATH = path.join(process.cwd(), "data", "anomalies-cache.json")
const TCGGO_RATE_LIMIT_MS = 2100

function resolveWatchlistCardId(card: WatchlistCard): string {
  if (card.id.startsWith("poke-") || card.id.startsWith("pc-")) return card.id
  if (card.pokemonTcgId?.startsWith("poke-")) return card.pokemonTcgId
  if (card.pokemonTcgId) return `poke-${card.pokemonTcgId.replace(/^poke-/, "")}`
  if (card.priceChartingId) return `pc-${card.priceChartingId}`
  return card.id
}

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
  }
}

/** SlabCrack / SlabIt feed sync — TCGPlayer raw market + eBay PSA medians from pokemon-api. */
export async function syncAnomaliesFromTcgGo(): Promise<SyncResult> {
  if (!hasTcgGoApiKey()) {
    throw new Error("RAPIDAPI_POKEMON_TCG_KEY is not configured")
  }

  const watchlist = await loadWatchlist()
  console.log(`[sync] pokemon-api: processing ${watchlist.length} watchlist cards...`)
  const anomalies: MockCardEntry[] = []
  const alerts: string[] = []
  let priced = 0
  let skipped = 0

  for (const card of watchlist) {
    try {
      const cardId = resolveWatchlistCardId(card)
      const fetched = await fetchCardPricesForTarget({
        cardId,
        cardName: card.cardName,
        setName: card.setName,
        cardNumber: card.cardNumber,
        legacyPriceChartingId: card.priceChartingId,
        tcgplayerId: undefined,
      })

      if (fetched.rawPrice <= 0) {
        console.warn(`[sync] No TCGPlayer market price for ${card.cardName}`)
        skipped += 1
        await new Promise((resolve) => setTimeout(resolve, TCGGO_RATE_LIMIT_MS))
        continue
      }

      const grades = [
        { grade: 7, price: fetched.psa7Price },
        { grade: 8, price: fetched.psa8Price },
        { grade: 9, price: fetched.psa9Price },
        { grade: 10, price: fetched.psa10Price },
      ].filter((g) => g.price > 0)

      const gradeQuotes = buildGradeQuotesFromPrices(fetched.rawPrice, grades)
      const arbitrage = findBestArbitrage(fetched.rawPrice, grades)
      if (arbitrage) alerts.push(formatArbitrageAlert(card.cardName, arbitrage))

      const best = getBestGradeQuote(gradeQuotes)
      const imageUrl =
        card.imageUrl && !card.imageUrl.includes("placehold.co")
          ? card.imageUrl
          : card.imageUrl

      anomalies.push(
        normalizeCardEntry({
          id: card.id,
          pokemonTcgId: fetched.tcgId ? `poke-${fetched.tcgId.replace(/^poke-/, "")}` : card.pokemonTcgId,
          cardName: card.cardName,
          setName: card.setName,
          cardNumber: card.cardNumber,
          imageUrl,
          rawPrice: fetched.rawPrice,
          slabGrade: best?.grade ?? arbitrage?.slabGrade ?? 9,
          slabPrice: best?.slabPrice ?? arbitrage?.slabPrice ?? 0,
          deficit: best?.deficit ?? 0,
          percentageSavings: best?.percentageSavings ?? 0,
          gradeQuotes,
          marketInsight:
            "TCGPlayer raw market + eBay PSA medians from pokemon-api.com. Recent sold comps load on demand.",
          hasPricing: true,
        }),
      )
      priced += 1
    } catch (error) {
      skipped += 1
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[sync] Skipped ${card.cardName}: ${message}`)
    }

    await new Promise((resolve) => setTimeout(resolve, TCGGO_RATE_LIMIT_MS))
  }

  console.log(`[sync] pokemon-api done: ${priced} priced, ${skipped} skipped`)

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
    source: anomalies.length > 0 ? "tcggo" : "cache",
  }
}

export async function syncAnomalies(): Promise<SyncResult> {
  return syncAnomaliesFromTcgGo()
}
