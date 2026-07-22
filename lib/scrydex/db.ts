import { catalogSearchMinLength } from "@/lib/db/catalog-search-local"
import { queryScrydexCatalogSearchRows } from "@/lib/scrydex/catalog-search-local"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  extractGradedPrices,
  extractPopulationReports,
  extractRawPrices,
  flattenHistoryPoints,
  scrydexCardToRow,
  scrydexExpansionToRow,
} from "@/lib/scrydex/adapters"
import { formatUnknownError } from "@/lib/scrydex/errors"
import type { CatalogCardRow, ScrydexCard, ScrydexExpansionRef, TcgGame } from "@/lib/scrydex/types"

const CHUNK = 100

function dedupeByKey(
  rows: Record<string, unknown>[],
  keyFn: (row: Record<string, unknown>) => string,
): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    byKey.set(keyFn(row), row)
  }
  return [...byKey.values()]
}

async function upsertChunk(table: string, rows: Record<string, unknown>[]) {
  if (!isSupabaseConfigured() || rows.length === 0) return
  const supabase = createAdminClient()
  const { error } = await supabase.from(table).upsert(rows)
  if (error?.code === "42P01") return
  if (error) throw error
}

export async function upsertCatalogCards(rows: CatalogCardRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const payload = rows.map((row) => ({
    catalog_id: row.catalog_id,
    game: row.game,
    scrydex_id: row.scrydex_id,
    name: row.name,
    set_code: row.set_code,
    set_name: row.set_name,
    number: row.number,
    printed_number: row.printed_number,
    rarity: row.rarity,
    supertype: row.supertype,
    subtypes: row.subtypes,
    language_code: row.language_code,
    image_small_url: row.image_small_url,
    image_large_url: row.image_large_url,
    variants: row.variants,
    metadata: row.metadata ?? {},
    catalog_synced_at: new Date().toISOString(),
  }))

  const deduped = dedupeByKey(payload, (row) => String(row.catalog_id))

  for (let i = 0; i < deduped.length; i += CHUNK) {
    await upsertChunk("catalog_cards", deduped.slice(i, i + CHUNK))
  }
  return deduped.length
}

export async function upsertExpansions(
  game: TcgGame,
  expansions: Array<ScrydexExpansionRef | Record<string, unknown>>,
): Promise<number> {
  const rows = expansions
    .map((exp) => scrydexExpansionToRow(game, exp))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  for (let i = 0; i < rows.length; i += CHUNK) {
    await upsertChunk("expansions", rows.slice(i, i + CHUNK))
  }
  return rows.length
}

export async function persistCardPricingBundle(
  game: TcgGame,
  card: ScrydexCard | Record<string, unknown>,
): Promise<CatalogCardRow> {
  const row = scrydexCardToRow(game, card)
  await upsertCatalogCards([row])

  const variants = (card as ScrydexCard).variants
  const raw = extractRawPrices(row.catalog_id, variants)
  const graded = extractGradedPrices(row.catalog_id, variants)
  const population = extractPopulationReports(row.catalog_id, variants)

  await upsertChunk("prices_raw", raw)
  await upsertChunk("prices_graded", graded)
  await upsertChunk("population_reports", population)

  return row
}

export async function persistHistoryPoints(
  catalogId: string,
  points: Array<Record<string, unknown>>,
): Promise<number> {
  if (points.length === 0) return 0
  return persistHistoryPointsBatch(catalogId, points)
}

function applyNullableHistoryFilter<T extends { eq: (col: string, val: string) => T; is: (col: string, val: null) => T }>(
  query: T,
  column: string,
  value: unknown,
): T {
  if (value == null) return query.is(column, null)
  return query.eq(column, String(value))
}

/** Update or insert one daily history row (matches price_history_daily_unique_idx). */
async function upsertSingleDailyHistoryPoint(point: Record<string, unknown>): Promise<void> {
  const supabase = createAdminClient()
  let selectQuery = supabase
    .from("price_history_daily")
    .select("id")
    .eq("catalog_id", String(point.catalog_id))
    .eq("snapshot_date", String(point.snapshot_date))
    .eq("price_type", String(point.price_type))
    .eq("variant", String(point.variant ?? "normal"))

  selectQuery = applyNullableHistoryFilter(selectQuery, "condition", point.condition)
  selectQuery = applyNullableHistoryFilter(selectQuery, "company", point.company)
  selectQuery = applyNullableHistoryFilter(selectQuery, "grade", point.grade)

  const { data: existing, error: selectError } = await selectQuery.maybeSingle()
  if (selectError?.code === "42P01") return
  if (selectError) {
    throw new Error(formatUnknownError(selectError, "price_history_daily lookup failed"))
  }

  const payload = {
    market_price: point.market_price,
    low_price: point.low_price ?? null,
    currency: point.currency ?? "USD",
    source: point.source ?? "scrydex",
    captured_at: point.captured_at ?? new Date().toISOString(),
  }

  if (existing?.id != null) {
    const { error: updateError } = await supabase
      .from("price_history_daily")
      .update(payload)
      .eq("id", existing.id)
    if (updateError?.code === "42P01") return
    if (updateError) {
      throw new Error(formatUnknownError(updateError, "price_history_daily update failed"))
    }
    return
  }

  const { error: insertError } = await supabase.from("price_history_daily").insert(point)
  if (insertError?.code === "42P01") return
  if (insertError) {
    throw new Error(formatUnknownError(insertError, "price_history_daily insert failed"))
  }
}

/** Upsert all history rows in one database round-trip (atomic batch). */
export async function persistHistoryPointsBatch(
  catalogId: string,
  points: Array<Record<string, unknown>>,
): Promise<number> {
  if (!isSupabaseConfigured() || points.length === 0) return 0

  const normalized = points.map((point) => ({
    ...point,
    catalog_id: catalogId,
  }))

  const supabase = createAdminClient()
  const { error } = await supabase.from("price_history_daily").upsert(normalized)
  if (error?.code === "42P01") return 0
  if (error?.code === "23505") {
    for (const point of normalized) {
      await upsertSingleDailyHistoryPoint(point)
    }
    return normalized.length
  }
  if (error) {
    throw new Error(formatUnknownError(error, "price_history_daily upsert failed"))
  }
  return normalized.length
}

export async function countDistinctDailyHistoryDays(catalogId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("price_history_daily")
    .select("snapshot_date")
    .eq("catalog_id", catalogId)

  if (error?.code === "42P01") return 0
  if (error) {
    throw new Error(formatUnknownError(error, "price_history_daily count failed"))
  }

  const dates = new Set(
    (data ?? [])
      .map((row) => String((row as { snapshot_date?: string }).snapshot_date ?? "").slice(0, 10))
      .filter(Boolean),
  )
  return dates.size
}

export async function loadDailyHistoryRows(
  catalogId: string,
  days = 0,
  range?: { from?: string; to?: string },
): Promise<Array<Record<string, unknown>>> {
  if (!isSupabaseConfigured()) return []
  const supabase = createAdminClient()

  let query = supabase
    .from("price_history_daily")
    .select("*")
    .eq("catalog_id", catalogId)
    .order("snapshot_date", { ascending: true })

  if (range?.from) {
    query = query.gte("snapshot_date", range.from.slice(0, 10))
  }
  if (range?.to) {
    query = query.lte("snapshot_date", range.to.slice(0, 10))
  } else if (days > 0) {
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - days)
    query = query.gte("snapshot_date", since.toISOString().slice(0, 10))
  }

  const { data, error } = await query
  if (error?.code === "42P01") return []
  if (error) throw error
  return (data ?? []) as Array<Record<string, unknown>>
}

export async function getCatalogCard(catalogId: string): Promise<CatalogCardRow | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase.from("catalog_cards").select("*").eq("catalog_id", catalogId).maybeSingle()
  if (error?.code === "42P01") return null
  if (error) throw error
  return (data as CatalogCardRow | null) ?? null
}

export async function searchLocalCatalog(input: {
  game: TcgGame
  q: string
  page: number
  pageSize: number
}): Promise<{ cards: CatalogCardRow[]; total: number }> {
  if (!isSupabaseConfigured()) return { cards: [], total: 0 }

  const q = input.q.trim()
  if (!catalogSearchMinLength(q)) return { cards: [], total: 0 }

  const supabase = createAdminClient()
  const fetchLimit = Math.min(Math.max(input.pageSize * 4, 80), 200)

  try {
    const rows = await queryScrydexCatalogSearchRows(supabase, q, fetchLimit)
    const filtered = rows.filter((row) => row.game === input.game)
    const from = (input.page - 1) * input.pageSize
    const pageRows = filtered.slice(from, from + input.pageSize)
    return { cards: pageRows as CatalogCardRow[], total: filtered.length }
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "42P01") {
      return { cards: [], total: 0 }
    }
    throw error
  }
}

export async function getCardsWithPricesBatch(catalogIds: string[]) {
  if (!isSupabaseConfigured() || catalogIds.length === 0) return []
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("get_cards_with_prices_batch", { ids: catalogIds })
  if (error?.code === "42883") {
    // RPC not deployed yet — fallback join query
    const { data: fallback, error: fallbackError } = await supabase
      .from("catalog_cards")
      .select("*, prices_raw(*), prices_graded(*)")
      .in("catalog_id", catalogIds)
    if (fallbackError) throw fallbackError
    return fallback ?? []
  }
  if (error) throw error
  return data ?? []
}

export async function loadCardBundle(catalogId: string) {
  if (!isSupabaseConfigured()) return null
  const supabase = createAdminClient()

  const [cardRes, rawRes, gradedRes, popRes, histRes] = await Promise.all([
    supabase.from("catalog_cards").select("*").eq("catalog_id", catalogId).maybeSingle(),
    supabase.from("prices_raw").select("*").eq("catalog_id", catalogId),
    supabase.from("prices_graded").select("*").eq("catalog_id", catalogId),
    supabase.from("population_reports").select("*").eq("catalog_id", catalogId),
    supabase
      .from("price_history_daily")
      .select("*")
      .eq("catalog_id", catalogId)
      .order("snapshot_date", { ascending: false })
      .limit(120),
  ])

  if (cardRes.error?.code === "42P01") return null
  if (cardRes.error) throw cardRes.error
  if (!cardRes.data) return null

  return {
    card: cardRes.data as CatalogCardRow,
    raw: rawRes.data ?? [],
    graded: gradedRes.data ?? [],
    population: popRes.data ?? [],
    history: histRes.data ?? [],
  }
}

export async function isPriceStale(catalogId: string, staleBeforeMs: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return true
  const supabase = createAdminClient()
  const staleBefore = new Date(Date.now() - staleBeforeMs).toISOString()
  const { data, error } = await supabase
    .from("prices_raw")
    .select("synced_at")
    .eq("catalog_id", catalogId)
    .eq("variant", "normal")
    .eq("condition", "NM")
    .maybeSingle()

  if (error?.code === "42P01") return true
  if (error) throw error
  if (!data?.synced_at) return true
  return String(data.synced_at) < staleBefore
}

/** True when no PSA graded rows with a positive market price are cached. */
export async function isGradedPricesMissing(catalogId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return true
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("prices_graded")
    .select("market_price")
    .eq("catalog_id", catalogId)
    .ilike("company", "psa")
    .gt("market_price", 0)
    .limit(1)
    .maybeSingle()

  if (error?.code === "42P01") return true
  if (error) return true
  return !data
}

export async function getVisionCache(phash: string) {
  if (!isSupabaseConfigured()) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("vision_scan_cache")
    .select("catalog_id, confidence")
    .eq("phash", phash)
    .maybeSingle()
  if (error?.code === "42P01") return null
  if (error) throw error
  return data
}

export async function saveVisionCache(input: { phash: string; catalogId: string; confidence?: number }) {
  if (!isSupabaseConfigured()) return
  const supabase = createAdminClient()
  const { error } = await supabase.from("vision_scan_cache").upsert({
    phash: input.phash,
    catalog_id: input.catalogId,
    confidence: input.confidence ?? null,
    scanned_at: new Date().toISOString(),
  })
  if (error?.code === "42P01") return
  if (error) throw error
}

export { flattenHistoryPoints }
