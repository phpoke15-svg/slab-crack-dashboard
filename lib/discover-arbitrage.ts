import { enrichEntryImages } from "@/lib/card-images"
import { fetchPriceChartingProduct } from "@/lib/pricecharting"
import { upsertAnomaliesToDb } from "@/lib/db/anomalies"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"
import {
  candidateToAnomalyEntry,
  findArbitrageCandidates,
  loadMarketProductsFromCsvSource,
  mergeApiGrades,
  rowToArbitrage,
  scrapeAllPokemonSets,
  type ArbitrageCandidate,
  type MarketProductRow,
} from "@/lib/pricecharting-market"

export interface DiscoverResult {
  scanned: number
  arbitrageFound: number
  enriched: number
  imagesResolved: number
  saved: number
  topDeficit: number
  syncedAt: string
  source: "csv" | "scrape" | "scrape+api"
}

async function enrichWithApi(
  apiKey: string,
  rows: MarketProductRow[],
  limit: number,
): Promise<{ rows: MarketProductRow[]; enriched: number }> {
  const sorted = [...rows]
    .map((row) => {
      const quick = row.psa9 > 0 && row.psa9 < row.rawPrice ? row.rawPrice - row.psa9 : 0
      return { row, quick }
    })
    .sort((a, b) => b.quick - a.quick)
    .slice(0, limit)

  const byId = new Map(rows.map((row) => [row.pricechartingId, { ...row }]))
  let enriched = 0

  for (const { row } of sorted) {
    try {
      const product = await fetchPriceChartingProduct(apiKey, { id: row.pricechartingId })
      byId.set(row.pricechartingId, mergeApiGrades(row, product))
      enriched += 1
    } catch {
      /* keep scrape values */
    }
    await new Promise((r) => setTimeout(r, 1100))
  }

  return { rows: [...byId.values()], enriched }
}

async function persistDiscoveries(entries: MockCardEntry[]): Promise<number> {
  if (!isSupabaseConfigured() || entries.length === 0) return 0

  const supabase = createAdminClient()
  const keepIds = entries.map((e) => e.id)

  const { data: existing } = await supabase
    .from("slab_watchlist_cards")
    .select("id")
    .like("id", "pc-%")

  const stale = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.includes(id))

  if (stale.length > 0) {
    await supabase.from("slab_watchlist_cards").delete().in("id", stale)
  }

  for (const entry of entries) {
    const normalized = normalizeCardEntry(entry)
    const pcId = normalized.id.replace(/^pc-/, "")

    await supabase.from("slab_cards").upsert({
      id: normalized.id,
      name: normalized.cardName,
      set_name: normalized.setName,
      card_number: normalized.cardNumber,
      image_large: normalized.imageUrl,
      release_date: entry.releaseDate ?? null,
      updated_at: new Date().toISOString(),
    })

    await supabase.from("slab_watchlist_cards").upsert({
      id: normalized.id,
      card_id: normalized.id,
      pricecharting_id: pcId,
      search_query: `${normalized.cardName} ${normalized.cardNumber}`.toLowerCase(),
      market_insight: normalized.marketInsight,
    })
  }

  await upsertAnomaliesToDb(entries)
  return entries.length
}

export async function discoverArbitrageFromMarket(options?: {
  apiKey?: string
  csvPath?: string
  limit?: number
  minRawPrice?: number
  minDeficit?: number
  enrichLimit?: number
  onProgress?: (message: string) => void
}): Promise<DiscoverResult> {
  const apiKey = options?.apiKey ?? process.env.PRICECHARTING_API_KEY
  if (!apiKey) throw new Error("PRICECHARTING_API_KEY is not configured")

  const limit = options?.limit ?? Number(process.env.DISCOVERY_LIMIT ?? 200)
  const minRawPrice = options?.minRawPrice ?? Number(process.env.DISCOVERY_MIN_RAW_PRICE ?? 15)
  const minDeficit = options?.minDeficit ?? Number(process.env.DISCOVERY_MIN_DEFICIT ?? 5)
  const enrichLimit = options?.enrichLimit ?? Number(process.env.DISCOVERY_ENRICH_LIMIT ?? 300)
  const log = options?.onProgress ?? ((msg: string) => console.log(msg))

  let products = await loadMarketProductsFromCsvSource(
    apiKey,
    options?.csvPath ?? process.env.PRICECHARTING_CSV_PATH,
  )
  let source: DiscoverResult["source"] = "csv"

  if (products.length === 0) {
    log("[discover] No CSV found — scraping all Pokemon sets from PriceCharting...")
    products = await scrapeAllPokemonSets((done, total, slug) => {
      if (done % 10 === 0 || done === total) log(`[discover] Sets ${done}/${total} (${slug})`)
    })
    source = "scrape"

    const preFilter = products.filter((row) => row.psa9 > 0 && row.psa9 < row.rawPrice)
    if (preFilter.length > 0) {
      log(`[discover] Enriching top ${enrichLimit} candidates via API for PSA 7–10...`)
      const enriched = await enrichWithApi(apiKey, products, enrichLimit)
      products = enriched.rows
      source = "scrape+api"
      log(`[discover] API enriched ${enriched.enriched} products`)
    }
  }

  log(
    `[discover] Scanned ${products.length} EN/JP TCG products` +
      (process.env.DISCOVERY_MAX_SET_AGE_YEARS?.trim() &&
      process.env.DISCOVERY_MAX_SET_AGE_YEARS.trim() !== "0" &&
      !/^all$/i.test(process.env.DISCOVERY_MAX_SET_AGE_YEARS.trim())
        ? ` from sets released in the last ${process.env.DISCOVERY_MAX_SET_AGE_YEARS.trim()} years`
        : " (all-time set age)"),
  )

  let candidates = findArbitrageCandidates(products, { minRawPrice, minDeficit })

  if (source === "csv" && candidates.length > limit) {
    candidates = candidates.slice(0, limit)
  } else if (source !== "csv") {
    candidates = candidates.slice(0, limit)
  }

  const entries = candidates.map((c: ArbitrageCandidate) =>
    normalizeCardEntry(candidateToAnomalyEntry(c)),
  )

  log(`[discover] Resolving card artwork for ${entries.length} discoveries...`)
  const { entries: withImages, resolved: imagesResolved } = await enrichEntryImages(
    entries,
    (done, total) => {
      if (done % 25 === 0 || done === total) log(`[discover] Images ${done}/${total}`)
    },
  )

  const saved = await persistDiscoveries(withImages)

  return {
    scanned: products.length,
    arbitrageFound: candidates.length,
    enriched: source === "scrape+api" ? enrichLimit : 0,
    imagesResolved,
    saved,
    topDeficit: candidates[0]?.deficit ?? 0,
    syncedAt: new Date().toISOString(),
    source,
  }
}

export function quickScanRows(rows: MarketProductRow[]): ArbitrageCandidate[] {
  return rows.map(rowToArbitrage).filter((r): r is ArbitrageCandidate => r !== null)
}
