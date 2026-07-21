import { enrichEntryImages } from "@/lib/card-images"
import { readDiscoveryCatalogPage, writeDiscoveryCatalogPage } from "@/lib/db/discovery-scan-state"
import { upsertAnomaliesToDb } from "@/lib/db/anomalies"
import { hasTcgGoApiKey } from "@/lib/pricing/provider"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { normalizeCardEntry, type MockCardEntry } from "@/lib/slab-data"
import {
  candidateToAnomalyEntry,
  DISCOVERY_MARKET_INSIGHT,
  fetchTcgGoCatalogBatch,
  findTcgGoArbitrageCandidates,
  type TcgGoArbitrageCandidate,
} from "@/lib/tcggo-market-discovery"

export interface DiscoverResult {
  scanned: number
  arbitrageFound: number
  enriched: number
  imagesResolved: number
  saved: number
  topDeficit: number
  syncedAt: string
  source: "tcggo"
  catalogPage: number
  nextCatalogPage: number
  totalCatalogPages: number
}

async function persistDiscoveries(entries: MockCardEntry[]): Promise<number> {
  if (!isSupabaseConfigured() || entries.length === 0) return 0

  const supabase = createAdminClient()
  const keepIds = entries.map((e) => e.id)

  const { data: existing } = await supabase
    .from("slab_watchlist_cards")
    .select("id")
    .like("market_insight", `${DISCOVERY_MARKET_INSIGHT.slice(0, 40)}%`)

  const stale = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.includes(id))

  if (stale.length > 0) {
    await supabase.from("slab_watchlist_cards").delete().in("id", stale)
  }

  for (const entry of entries) {
    const normalized = normalizeCardEntry(entry)
    const tcgId = normalized.pokemonTcgId?.replace(/^poke-/, "") ?? normalized.id.replace(/^poke-/, "")

    await supabase.from("slab_cards").upsert({
      id: normalized.id.startsWith("poke-") ? normalized.id : `poke-${tcgId}`,
      name: normalized.cardName,
      set_name: normalized.setName,
      card_number: normalized.cardNumber,
      image_large: normalized.imageUrl,
      updated_at: new Date().toISOString(),
    })

    await supabase.from("slab_watchlist_cards").upsert({
      id: normalized.id,
      card_id: normalized.id.startsWith("poke-") ? normalized.id : `poke-${tcgId}`,
      pokemon_api_tcg_id: tcgId || null,
      legacy_pricecharting_id: null,
      search_query: `${normalized.cardName} ${normalized.cardNumber}`.toLowerCase(),
      market_insight: normalized.marketInsight,
    })
  }

  await upsertAnomaliesToDb(entries)
  return entries.length
}

export async function discoverArbitrageFromMarket(options?: {
  limit?: number
  minRawPrice?: number
  minDeficit?: number
  pagesPerRun?: number
  perPage?: number
  onProgress?: (message: string) => void
}): Promise<DiscoverResult> {
  if (!hasTcgGoApiKey()) {
    throw new Error("RAPIDAPI_POKEMON_TCG_KEY is not configured")
  }

  const limit = options?.limit ?? Number(process.env.DISCOVERY_LIMIT ?? 200)
  const minRawPrice = options?.minRawPrice ?? Number(process.env.DISCOVERY_MIN_RAW_PRICE ?? 15)
  const minDeficit = options?.minDeficit ?? Number(process.env.DISCOVERY_MIN_DEFICIT ?? 5)
  const pagesPerRun = options?.pagesPerRun ?? Number(process.env.DISCOVERY_PAGES_PER_RUN ?? 8)
  const perPage = options?.perPage ?? Number(process.env.DISCOVERY_PAGE_SIZE ?? 50)
  const log = options?.onProgress ?? ((msg: string) => console.log(msg))

  const startPage = await readDiscoveryCatalogPage()
  log(`[discover] Scanning pokemon-api catalog from page ${startPage} (${pagesPerRun} pages × ${perPage} cards)...`)

  const batch = await fetchTcgGoCatalogBatch(startPage, pagesPerRun, perPage)
  await writeDiscoveryCatalogPage(batch.endPage, batch.totalPages)

  log(
    `[discover] Scanned ${batch.rows.length} priced EN/JP cards (pages ${batch.startPage}–${batch.endPage} of ~${batch.totalPages})`,
  )

  let candidates = findTcgGoArbitrageCandidates(batch.rows, { minRawPrice, minDeficit })
  candidates = candidates.slice(0, limit)

  const entries = candidates.map((c: TcgGoArbitrageCandidate) =>
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
    scanned: batch.rows.length,
    arbitrageFound: candidates.length,
    enriched: batch.rows.length,
    imagesResolved,
    saved,
    topDeficit: candidates[0]?.deficit ?? 0,
    syncedAt: new Date().toISOString(),
    source: "tcggo",
    catalogPage: batch.startPage,
    nextCatalogPage: batch.endPage,
    totalCatalogPages: batch.totalPages,
  }
}
