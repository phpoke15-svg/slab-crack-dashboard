import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { isCachedPriceFromActiveProvider } from "@/lib/pricing/provider"
import type { ActivePriceProvider } from "@/lib/pricing/provider"
import type { CardPriceRow, CardPriceTarget, FetchedCardPrices, PriceHistoryPoint } from "@/lib/pricing/types"

const PAGE_SIZE = 1000

function rowToCardPrice(row: Record<string, unknown>): CardPriceRow {
  return {
    card_id: String(row.card_id),
    raw_price: row.raw_price == null ? null : Number(row.raw_price),
    psa7_price: row.psa7_price == null ? null : Number(row.psa7_price),
    psa8_price: row.psa8_price == null ? null : Number(row.psa8_price),
    psa9_price: row.psa9_price == null ? null : Number(row.psa9_price),
    psa10_price: row.psa10_price == null ? null : Number(row.psa10_price),
    price_source: String(row.price_source ?? "tcggo"),
    synced_at: String(row.synced_at),
    sync_error: row.sync_error == null ? null : String(row.sync_error),
    card_name: row.card_name == null ? null : String(row.card_name),
    card_set: row.card_set == null ? null : String(row.card_set),
    card_number: row.card_number == null ? null : String(row.card_number),
    tcggo_id: row.tcggo_id == null ? null : Number(row.tcggo_id),
    tcgplayer_id: row.tcgplayer_id == null ? null : Number(row.tcgplayer_id),
    tcg_id: row.tcg_id == null ? null : String(row.tcg_id),
    language:
      row.language === "ja" ? "ja" : row.language === "en" ? "en" : null,
    legacy_pricecharting_id:
      row.legacy_pricecharting_id == null ? null : String(row.legacy_pricecharting_id),
  }
}

export function isCardPricesTableAvailable(): boolean {
  return isSupabaseConfigured()
}

export async function getCardPricesForIds(cardIds: string[]): Promise<Map<string, CardPriceRow>> {
  const prices = new Map<string, CardPriceRow>()
  if (!isSupabaseConfigured() || cardIds.length === 0) return prices

  const supabase = createAdminClient()
  const chunkSize = 200

  try {
    for (let i = 0; i < cardIds.length; i += chunkSize) {
      const chunk = cardIds.slice(i, i + chunkSize)
      const { data, error } = await supabase.from("card_prices").select("*").in("card_id", chunk)

      if (error) {
        if (error.code === "42P01") return prices
        throw error
      }

      for (const row of data ?? []) {
        const parsed = rowToCardPrice(row as Record<string, unknown>)
        prices.set(parsed.card_id, parsed)
      }
    }
  } catch (error) {
    console.error("[card-prices] read by ids failed:", error)
  }

  return prices
}

export async function getCardPricesMap(): Promise<Map<string, CardPriceRow>> {
  const prices = new Map<string, CardPriceRow>()
  if (!isSupabaseConfigured()) return prices

  try {
    const supabase = createAdminClient()
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from("card_prices")
        .select("*")
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        if (error.code === "42P01") return prices
        throw error
      }
      if (!data?.length) break

      for (const row of data) {
        const parsed = rowToCardPrice(row as Record<string, unknown>)
        prices.set(parsed.card_id, parsed)
      }

      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  } catch (error) {
    console.error("[card-prices] read failed:", error)
  }

  return prices
}

export async function getRawPriceMapFromCardPrices(): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const rows = await getCardPricesMap()
  for (const [cardId, row] of rows) {
    if (row.raw_price != null && row.raw_price > 0) {
      map.set(cardId, row.raw_price)
    }
  }
  return map
}

export async function getCardPriceById(cardId: string): Promise<CardPriceRow | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("card_prices")
      .select("*")
      .eq("card_id", cardId)
      .maybeSingle()

    if (error) {
      if (error.code === "42P01") return null
      throw error
    }
    return data ? rowToCardPrice(data as Record<string, unknown>) : null
  } catch (error) {
    console.error("[card-prices] get by id failed:", error)
    return null
  }
}

export async function listStaleCardPriceIds(
  cardIds: string[],
  staleBeforeIso: string,
  options?: { provider?: ActivePriceProvider | null },
): Promise<Set<string>> {
  if (!isSupabaseConfigured() || cardIds.length === 0) return new Set(cardIds)

  const supabase = createAdminClient()
  const stale = new Set<string>()
  const chunkSize = 200
  const provider = options?.provider ?? null

  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("card_prices")
      .select("card_id, synced_at, price_source")
      .in("card_id", chunk)

    if (error) {
      if (error.code === "42P01") return new Set(cardIds)
      throw error
    }

    const rowsById = new Map(
      ((data ?? []) as { card_id: string; synced_at: string; price_source?: string | null }[]).map((row) => [
        row.card_id,
        row,
      ]),
    )

    for (const id of chunk) {
      const row = rowsById.get(id)
      if (!row || row.synced_at < staleBeforeIso) {
        stale.add(id)
        continue
      }
      if (provider && !isCachedPriceFromActiveProvider({ price_source: row.price_source ?? "pricecharting" }, provider)) {
        stale.add(id)
      }
    }
  }

  return stale
}

function mergeFetchedWithExisting(
  existing: CardPriceRow | null,
  target: CardPriceTarget,
  fetched: FetchedCardPrices | null,
  syncedAt: string,
  syncError: string | null,
): Record<string, unknown> | null {
  const hasExistingPrice =
    existing != null &&
    ((existing.raw_price ?? 0) > 0 ||
      (existing.psa7_price ?? 0) > 0 ||
      (existing.psa8_price ?? 0) > 0 ||
      (existing.psa9_price ?? 0) > 0 ||
      (existing.psa10_price ?? 0) > 0)

  if (!fetched) {
    if (!hasExistingPrice) return null
    return {
      card_id: target.cardId,
      sync_error: syncError,
      synced_at: syncedAt,
      card_name: target.cardName,
      card_set: target.setName,
      card_number: target.cardNumber ?? existing?.card_number ?? "",
    }
  }

  const rawPrice = fetched.rawPrice > 0 ? fetched.rawPrice : (existing?.raw_price ?? null)
  const psa7 = fetched.psa7Price > 0 ? fetched.psa7Price : (existing?.psa7_price ?? null)
  const psa8 = fetched.psa8Price > 0 ? fetched.psa8Price : (existing?.psa8_price ?? null)
  const psa9 = fetched.psa9Price > 0 ? fetched.psa9Price : (existing?.psa9_price ?? null)
  const psa10 = fetched.psa10Price > 0 ? fetched.psa10Price : (existing?.psa10_price ?? null)

  if ((rawPrice ?? 0) <= 0 && (psa7 ?? 0) <= 0 && (psa8 ?? 0) <= 0 && (psa9 ?? 0) <= 0 && (psa10 ?? 0) <= 0) {
    if (!hasExistingPrice) return null
    return {
      card_id: target.cardId,
      sync_error: syncError ?? "No valid prices returned",
      synced_at: syncedAt,
      card_name: target.cardName,
      card_set: target.setName,
      card_number: target.cardNumber ?? existing?.card_number ?? "",
    }
  }

  return {
    card_id: target.cardId,
    raw_price: rawPrice,
    psa7_price: psa7,
    psa8_price: psa8,
    psa9_price: psa9,
    psa10_price: psa10,
    price_source: fetched.priceSource,
    synced_at: syncedAt,
    sync_error: syncError,
    card_name: target.cardName,
    card_set: target.setName,
    card_number: target.cardNumber ?? "",
  }
}

export async function upsertCardPricesSafe(
  updates: Array<{
    target: CardPriceTarget
    fetched: FetchedCardPrices | null
    syncError?: string | null
  }>,
): Promise<{ count: number; error: string | null }> {
  if (!isSupabaseConfigured() || updates.length === 0) {
    return { count: 0, error: null }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase admin client unavailable"
    return { count: 0, error: message }
  }

  const syncedAt = new Date().toISOString()
  const cardIds = [...new Set(updates.map((update) => update.target.cardId))]
  const existingMap = await getCardPricesForIds(cardIds)
  const payload: Record<string, unknown>[] = []

  for (const update of updates) {
    const existing = existingMap.get(update.target.cardId) ?? null
    const row = mergeFetchedWithExisting(
      existing,
      update.target,
      update.fetched,
      syncedAt,
      update.syncError ?? null,
    )
    if (row) payload.push(row)
  }

  if (payload.length === 0) return { count: 0, error: null }

  const chunkSize = 100
  let written = 0
  let lastError: string | null = null

  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize)
    const { error } = await supabase.from("card_prices").upsert(chunk, { onConflict: "card_id" })
    if (error) {
      if (error.code === "42P01") {
        return { count: written, error: "card_prices table not found — run supabase/unified-card-prices.sql" }
      }
      lastError = error.message
      console.error("[card-prices] upsert chunk failed:", error)
      continue
    }
    written += chunk.length
  }

  return { count: written, error: lastError }
}

export async function appendPriceHistory(points: PriceHistoryPoint[]): Promise<void> {
  if (!isSupabaseConfigured() || points.length === 0) return

  const supabase = createAdminClient()
  const capturedAt = new Date().toISOString()
  const payload = points.map((point) => ({
    card_id: point.cardId,
    snapshot_date: point.snapshotDate,
    grade: point.grade,
    price: point.price,
    sale_count: point.saleCount ?? null,
    source: point.source,
    captured_at: capturedAt,
  }))

  const { error } = await supabase.from("price_history").upsert(payload, {
    onConflict: "card_id,snapshot_date,grade",
  })

  if (error && error.code !== "42P01") {
    throw error
  }
}

export async function getPriceHistoryForCard(
  cardId: string,
  grade: number,
  days = 30,
): Promise<PriceHistoryPoint[]> {
  if (!isSupabaseConfigured()) return []

  try {
    const supabase = createAdminClient()
    let query = supabase
      .from("price_history")
      .select("card_id, snapshot_date, grade, price, sale_count, source")
      .eq("card_id", cardId)
      .eq("grade", grade)
      .order("snapshot_date", { ascending: true })

    if (days > 0) {
      const since = new Date()
      since.setUTCDate(since.getUTCDate() - days)
      query = query.gte("snapshot_date", since.toISOString().slice(0, 10))
    }

    const { data, error } = await query

    if (error) {
      if (error.code === "42P01") return []
      throw error
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      cardId: String(row.card_id),
      snapshotDate: String(row.snapshot_date),
      grade: Number(row.grade),
      price: Number(row.price),
      saleCount: row.sale_count == null ? undefined : Number(row.sale_count),
      source: String(row.source),
    }))
  } catch (error) {
    console.error("[price-history] read failed:", error)
    return []
  }
}
