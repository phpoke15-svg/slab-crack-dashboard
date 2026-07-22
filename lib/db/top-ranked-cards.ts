import { getCatalogFeedFromDb, isSupabaseConfigured } from "@/lib/db/catalog-feed"
import { readSlabItTopCache, writeSlabItTopCache } from "@/lib/db/slabit-top-cache"
import { readAnomaliesCache } from "@/lib/sync-anomalies"
import { enrichMockEntriesWithScrydexGrades } from "@/lib/grading/enrich-scrydex-grades"
import mockData from "@/lib/mockData.json"
import {
  buildGradeQuotes,
  normalizeCardEntry,
  type MockCardEntry,
} from "@/lib/slab-data"
import { getSlabLabOpportunities } from "@/lib/slablab"
import { toSlabLabCard, type SlabLabCard } from "@/lib/slablab-card"
import { isSlabItCacheFresh, isSlabItEligibleRelease } from "@/lib/slabit-config"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"
import { createAdminClient } from "@/lib/supabase/server"

type RankedCardRow = {
  id: string
  name: string
  set_name: string
  set_id: string
  number: string
  rarity: string | null
  image_url: string | null
  scrydex_id: string | null
  current_price_raw: number | null
  current_price_psa10: number | null
  price_updated_at: string | null
  release_date?: string | null
}

const MARKET_SCAN_PAGE_SIZE = 1000
const MARKET_SCAN_MAX_PAGES = 100
const MARKET_SCAN_TTL_MS = 5 * 60 * 1000
const EXPANSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000

let pricedMarketCache: { rows: RankedCardRow[]; fetchedAt: number } | null = null
let expansionReleaseCache: { map: Map<string, string | null>; fetchedAt: number } | null = null

function pokemonTcgIdFromRow(row: RankedCardRow): string {
  if (row.id.startsWith("poke-")) return row.id.slice("poke-".length)
  if (row.scrydex_id) return row.scrydex_id
  return row.id
}

export function crackDeficitForRow(row: RankedCardRow): number {
  const raw = Number(row.current_price_raw) || 0
  const psa10 = Number(row.current_price_psa10) || 0
  return raw > psa10 ? raw - psa10 : 0
}

export function gradeSpreadForRow(row: RankedCardRow): number {
  const raw = Number(row.current_price_raw) || 0
  const psa10 = Number(row.current_price_psa10) || 0
  return psa10 > raw ? psa10 - raw : 0
}

export function filterSlabItEligibleRows(rows: RankedCardRow[]): RankedCardRow[] {
  return rows.filter((row) => isSlabItEligibleRelease(row.release_date))
}

export function rankCrackArbitrageRows(rows: RankedCardRow[], limit: number): RankedCardRow[] {
  return rows
    .filter((row) => crackDeficitForRow(row) > 0)
    .sort((a, b) => crackDeficitForRow(b) - crackDeficitForRow(a))
    .slice(0, limit)
}

export function rankSlabItSpreadRows(rows: RankedCardRow[], limit: number): RankedCardRow[] {
  return rows
    .filter((row) => gradeSpreadForRow(row) > 0)
    .sort((a, b) => gradeSpreadForRow(b) - gradeSpreadForRow(a))
    .slice(0, limit)
}

/** SlabCrack: slab cheaper than raw — deficit = raw − PSA 10. */
export function rankedCardRowToCrackEntry(row: RankedCardRow): MockCardEntry | null {
  const raw = Number(row.current_price_raw) || 0
  const psa10 = Number(row.current_price_psa10) || 0
  if (raw <= 0 || psa10 <= 0 || raw <= psa10) return null

  const deficit = raw - psa10
  const gradeQuotes = buildGradeQuotes(raw, {
    10: { slabPrice: psa10, recentSlabSales: [] },
  })

  return normalizeCardEntry({
    id: row.id.startsWith("poke-") ? row.id : `poke-${pokemonTcgIdFromRow(row)}`,
    pokemonTcgId: pokemonTcgIdFromRow(row),
    cardName: row.name,
    setName: row.set_name,
    cardNumber: row.number,
    imageUrl: row.image_url ?? "/placeholder.svg",
    rawPrice: raw,
    slabGrade: 10,
    slabPrice: psa10,
    deficit,
    percentageSavings: Math.round((deficit / raw) * 100),
    gradeQuotes,
    hasPricing: true,
    marketInsight: "Crack arbitrage ranked from whole-market Scrydex prices (raw NM vs PSA 10).",
  })
}

/** SlabIt feed mapper — spread ranking happens before mapping. */
export function rankedCardRowToMockEntry(row: RankedCardRow): MockCardEntry | null {
  const raw = Number(row.current_price_raw) || 0
  const psa10 = Number(row.current_price_psa10) || 0
  if (raw <= 0 || psa10 <= 0) return null

  const gradeQuotes = buildGradeQuotes(raw, {
    10: { slabPrice: psa10, recentSlabSales: [] },
  })

  return normalizeCardEntry({
    id: row.id.startsWith("poke-") ? row.id : `poke-${pokemonTcgIdFromRow(row)}`,
    pokemonTcgId: pokemonTcgIdFromRow(row),
    cardName: row.name,
    setName: row.set_name,
    cardNumber: row.number,
    imageUrl: row.image_url ?? "/placeholder.svg",
    releaseDate: row.release_date ?? undefined,
    rawPrice: raw,
    slabGrade: 10,
    slabPrice: psa10,
    deficit: Math.max(0, raw - psa10),
    percentageSavings: raw > psa10 ? Math.round(((raw - psa10) / raw) * 100) : 0,
    gradeQuotes,
    hasPricing: true,
    marketInsight: "Grading spread ranked from whole-market Scrydex prices (PSA 10 vs raw NM).",
  })
}

async function loadExpansionReleaseMap(forceRefresh = false): Promise<Map<string, string | null>> {
  if (
    !forceRefresh &&
    expansionReleaseCache &&
    Date.now() - expansionReleaseCache.fetchedAt < EXPANSION_CACHE_TTL_MS
  ) {
    return expansionReleaseCache.map
  }

  const map = new Map<string, string | null>()
  if (!isSupabaseConfigured()) {
    expansionReleaseCache = { map, fetchedAt: Date.now() }
    return map
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from("expansions").select("id, release_date").eq("game", "pokemon")

  if (error?.code === "42P01") {
    expansionReleaseCache = { map, fetchedAt: Date.now() }
    return map
  }
  if (error) throw error

  for (const row of data ?? []) {
    map.set(String(row.id), row.release_date ? String(row.release_date) : null)
  }

  expansionReleaseCache = { map, fetchedAt: Date.now() }
  return map
}

async function attachExpansionReleaseDates(rows: RankedCardRow[]): Promise<RankedCardRow[]> {
  const releaseBySetId = await loadExpansionReleaseMap()
  return rows.map((row) => ({
    ...row,
    release_date: releaseBySetId.get(row.set_id) ?? null,
  }))
}

async function fetchAllPricedCardRows(forceRefresh = false): Promise<RankedCardRow[]> {
  if (
    !forceRefresh &&
    pricedMarketCache &&
    Date.now() - pricedMarketCache.fetchedAt < MARKET_SCAN_TTL_MS
  ) {
    return pricedMarketCache.rows
  }

  if (!isSupabaseConfigured()) return []

  const supabase = createAdminClient()
  const rows: RankedCardRow[] = []

  for (let page = 0; page < MARKET_SCAN_MAX_PAGES; page++) {
    const from = page * MARKET_SCAN_PAGE_SIZE
    const to = from + MARKET_SCAN_PAGE_SIZE - 1

    const { data, error } = await supabase
      .from("cards")
      .select(
        "id, name, set_name, set_id, number, rarity, image_url, scrydex_id, current_price_raw, current_price_psa10, price_updated_at",
      )
      .not("current_price_raw", "is", null)
      .gt("current_price_raw", 0)
      .not("current_price_psa10", "is", null)
      .gt("current_price_psa10", 0)
      .order("id", { ascending: true })
      .range(from, to)

    if (error?.code === "42703" || error?.code === "42P01") return []
    if (error) throw error

    const batch = (data ?? []) as RankedCardRow[]
    rows.push(...batch)
    if (batch.length < MARKET_SCAN_PAGE_SIZE) break
  }

  pricedMarketCache = { rows, fetchedAt: Date.now() }
  return rows
}

async function loadLegacyFeed(limit: number): Promise<MockCardEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const feed = await getCatalogFeedFromDb()
      if (feed.length > 0) return feed.map(normalizeCardEntry).slice(0, limit)
    } catch (error) {
      console.warn("[top-ranked-cards] legacy feed failed:", error)
    }
  }

  const cached = await readAnomaliesCache()
  if (cached.length > 0) return cached.map(normalizeCardEntry).slice(0, limit)

  return (mockData as MockCardEntry[]).map(normalizeCardEntry).slice(0, limit)
}

/** Top SlabCrack cards: whole-market scan, ranked by raw − PSA 10 deficit. */
export async function getTopSlabCrackCards(limit = TOP_CARDS_LIMIT): Promise<MockCardEntry[]> {
  try {
    const market = await fetchAllPricedCardRows()
    const rows = rankCrackArbitrageRows(market, limit)
    const entries = rows
      .map(rankedCardRowToCrackEntry)
      .filter((entry): entry is MockCardEntry => entry != null)
      .sort((a, b) => b.deficit - a.deficit)

    if (entries.length > 0) {
      const enriched = await enrichMockEntriesWithScrydexGrades(entries)
      return enriched.slice(0, limit)
    }
  } catch (error) {
    console.warn("[top-ranked-cards] SlabCrack market scan failed:", error)
  }

  const legacy = await loadLegacyFeed(limit * 3)
  return legacy
    .filter((card) => card.hasPricing !== false && card.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, limit)
}

async function computeTopSlabItCards(limit = TOP_CARDS_LIMIT): Promise<SlabLabCard[]> {
  try {
    const market = await attachExpansionReleaseDates(await fetchAllPricedCardRows())
    const eligible = filterSlabItEligibleRows(market)
    const rows = rankSlabItSpreadRows(eligible, limit)
    const cards = rows
      .map(rankedCardRowToMockEntry)
      .filter((entry): entry is MockCardEntry => entry != null)
      .map(toSlabLabCard)
      .filter((card): card is SlabLabCard => card != null)
      .sort((a, b) => b.psa10Price - b.rawPrice - (a.psa10Price - a.rawPrice))

    if (cards.length > 0) return cards.slice(0, limit)
  } catch (error) {
    console.warn("[top-ranked-cards] SlabIt market scan failed:", error)
  }

  return getSlabLabOpportunities(limit)
}

/** Rebuild and persist the daily SlabIt top-100 cache (cron). */
export async function refreshSlabItTopCache(limit = TOP_CARDS_LIMIT) {
  pricedMarketCache = null
  expansionReleaseCache = null
  const cards = await computeTopSlabItCards(limit)
  return writeSlabItTopCache(cards)
}

/** Top SlabIt cards: recent sets only, refreshed daily from live market prices. */
export async function getTopSlabItCards(
  limit = TOP_CARDS_LIMIT,
  options?: { forceRefresh?: boolean },
): Promise<SlabLabCard[]> {
  if (!options?.forceRefresh) {
    const cache = await readSlabItTopCache()
    if (cache && isSlabItCacheFresh(cache.syncedAt)) {
      return cache.cards.slice(0, limit)
    }
  }

  const cards = await computeTopSlabItCards(limit)
  if (cards.length > 0) {
    await writeSlabItTopCache(cards)
  }
  return cards.slice(0, limit)
}

export async function getSlabItTopSyncedAt(): Promise<string | null> {
  const cache = await readSlabItTopCache()
  return cache?.syncedAt ?? null
}
