import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { promoCardMeta } from "@/lib/trade-binder/promo-card-meta"
import type { CardPriceTarget } from "@/lib/pricing/types"

export type CatalogHistoryBatch = {
  targets: CardPriceTarget[]
  catalogSize: number
  cursorOffset: number
  nextOffset: number
}

function catalogRowToTarget(row: {
  id: string
  name: string
  set_name: string
  number: string | null
}): CardPriceTarget {
  const meta = promoCardMeta(row.id)
  return {
    cardId: row.id,
    cardName: row.name,
    setName: row.set_name,
    cardNumber: row.number ?? undefined,
    tcgGoId: meta?.tcgGoId,
    tcgplayerId: meta?.tcgplayerId,
  }
}

export async function getCatalogCardTotal(): Promise<number> {
  if (!isSupabaseConfigured()) return 0

  try {
    const supabase = createAdminClient()
    const { count, error } = await supabase.from("cards").select("*", { count: "exact", head: true })
    if (error) {
      if (error.code === "42P01") return 0
      throw error
    }
    return count ?? 0
  } catch (error) {
    console.warn("[history-cursor] catalog count failed:", error)
    return 0
  }
}

export async function readHistorySyncCursor(): Promise<number> {
  if (!isSupabaseConfigured()) return 0

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("price_history_sync_state")
      .select("cursor_offset")
      .eq("id", 1)
      .maybeSingle()

    if (error || !data) return 0
    const offset = Number((data as { cursor_offset: number }).cursor_offset)
    return Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0
  } catch {
    return 0
  }
}

export async function writeHistorySyncCursor(offset: number, catalogSize: number): Promise<void> {
  if (!isSupabaseConfigured()) return

  try {
    const supabase = createAdminClient()
    await supabase.from("price_history_sync_state").upsert(
      {
        id: 1,
        cursor_offset: offset,
        catalog_size: catalogSize,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
  } catch (error) {
    console.warn("[history-cursor] failed to persist cursor:", error)
  }
}

export function advanceHistoryCursor(
  offset: number,
  batchSize: number,
  catalogSize: number,
): number {
  if (catalogSize <= 0) return 0
  const next = offset + batchSize
  return next >= catalogSize ? 0 : next
}

export async function listCatalogHistoryTargets(
  offset: number,
  limit: number,
): Promise<CatalogHistoryBatch> {
  if (!isSupabaseConfigured() || limit <= 0) {
    return { targets: [], catalogSize: 0, cursorOffset: offset, nextOffset: 0 }
  }

  const catalogSize = await getCatalogCardTotal()
  if (catalogSize === 0) {
    return { targets: [], catalogSize: 0, cursorOffset: offset, nextOffset: 0 }
  }

  const start = offset % catalogSize
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("cards")
    .select("id, name, set_name, number")
    .order("id", { ascending: true })
    .range(start, start + limit - 1)

  if (error) {
    if (error.code === "42P01") {
      return { targets: [], catalogSize: 0, cursorOffset: offset, nextOffset: 0 }
    }
    throw error
  }

  const targets = ((data ?? []) as Array<{
    id: string
    name: string
    set_name: string
    number: string | null
  }>).map(catalogRowToTarget)

  const nextOffset = advanceHistoryCursor(start, targets.length, catalogSize)

  return {
    targets,
    catalogSize,
    cursorOffset: start,
    nextOffset,
  }
}
