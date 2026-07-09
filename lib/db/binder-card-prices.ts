import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

export type BinderCardPriceRow = {
  card_id: string
  raw_price: number
  card_name: string
  card_set: string
  card_number: string
  synced_at: string
}

export async function getBinderCardPriceById(): Promise<Map<string, number>> {
  if (!isSupabaseConfigured()) return new Map()

  try {
    const supabase = createAdminClient()
    const pageSize = 1000
    let from = 0
    const prices = new Map<string, number>()

    while (true) {
      const { data, error } = await supabase
        .from("binder_card_prices")
        .select("card_id, raw_price")
        .gt("raw_price", 0)
        .range(from, from + pageSize - 1)

      if (error) throw error
      if (!data?.length) break

      for (const row of data as { card_id: string; raw_price: number }[]) {
        prices.set(row.card_id, Number(row.raw_price))
      }

      if (data.length < pageSize) break
      from += pageSize
    }

    return prices
  } catch (error) {
    console.error("[binder-card-prices] read failed:", error)
    return new Map()
  }
}

export type BinderPriceTarget = {
  id: string
  name: string
  set: string
  cardNumber?: string
}

export async function listDistinctBinderCards(): Promise<BinderPriceTarget[]> {
  if (!isSupabaseConfigured()) return []

  const supabase = createAdminClient()
  const pageSize = 1000
  let from = 0
  const byId = new Map<string, BinderPriceTarget>()

  while (true) {
    const { data, error } = await supabase
      .from("user_binders")
      .select("card_id, card_name, card_set, card_number, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break

    for (const row of data as {
      card_id: string
      card_name: string | null
      card_set: string | null
      card_number: string | null
    }[]) {
      if (!row.card_id?.trim() || byId.has(row.card_id)) continue
      byId.set(row.card_id, {
        id: row.card_id,
        name: row.card_name?.trim() || "Unknown card",
        set: row.card_set?.trim() || "Unknown Set",
        cardNumber: row.card_number?.trim() || undefined,
      })
    }

    if (data.length < pageSize) break
    from += pageSize
  }

  return [...byId.values()]
}

export async function listStaleBinderCardIds(
  cardIds: string[],
  staleBeforeIso: string,
): Promise<Set<string>> {
  if (!isSupabaseConfigured() || cardIds.length === 0) return new Set(cardIds)

  const supabase = createAdminClient()
  const stale = new Set<string>()
  const chunkSize = 200

  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("binder_card_prices")
      .select("card_id, synced_at")
      .in("card_id", chunk)

    if (error) throw error

    const fresh = new Set(
      ((data ?? []) as { card_id: string; synced_at: string }[])
        .filter((row) => row.synced_at >= staleBeforeIso)
        .map((row) => row.card_id),
    )

    for (const id of chunk) {
      if (!fresh.has(id)) stale.add(id)
    }
  }

  return stale
}

export async function upsertBinderCardPrices(
  rows: {
    cardId: string
    rawPrice: number
    cardName: string
    cardSet: string
    cardNumber?: string
  }[],
): Promise<number> {
  if (!isSupabaseConfigured() || rows.length === 0) return 0

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const payload = rows
    .filter((row) => row.rawPrice > 0)
    .map((row) => ({
      card_id: row.cardId,
      raw_price: row.rawPrice,
      card_name: row.cardName,
      card_set: row.cardSet,
      card_number: row.cardNumber ?? "",
      synced_at: now,
    }))

  if (payload.length === 0) return 0

  const { error } = await supabase.from("binder_card_prices").upsert(payload, {
    onConflict: "card_id",
  })

  if (error) throw error
  return payload.length
}
