import type { SupabaseClient } from "@supabase/supabase-js"
import type { CardStatus, CatalogCard, Rarity, TcgCard } from "@/lib/trade-binder/cards"

export type UserBinderRow = {
  card_id: string
  status: CardStatus
  card_name?: string | null
  card_set?: string | null
  card_image?: string | null
  card_rarity?: string | null
}

function rowToCard(row: UserBinderRow): TcgCard | null {
  if (!row.card_name || !row.card_set || !row.card_image || !row.card_rarity) return null
  return {
    id: row.card_id,
    name: row.card_name,
    set: row.card_set,
    image: row.card_image,
    rarity: row.card_rarity as Rarity,
    status: row.status,
  }
}

export async function fetchUserBinder(supabase: SupabaseClient, userId: string): Promise<UserBinderRow[]> {
  const { data, error } = await supabase.from("user_binders").select("*").eq("user_id", userId)

  if (error) throw error
  return data ?? []
}

export async function loadBinderCards(supabase: SupabaseClient, userId: string): Promise<TcgCard[]> {
  const rows = await fetchUserBinder(supabase, userId)
  if (rows.length === 0) return []

  const fromDb = rows.map(rowToCard).filter((c): c is TcgCard => c !== null)
  const missingMeta = rows.filter((r) => !r.card_name)

  if (missingMeta.length === 0) return fromDb

  const enriched = await enrichBinderCards(missingMeta)
  return [...fromDb, ...enriched]
}

export async function enrichBinderCards(rows: UserBinderRow[]): Promise<TcgCard[]> {
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.card_id).join(",")
  const res = await fetch(`/api/binder/batch?ids=${encodeURIComponent(ids)}`)
  if (!res.ok) return []

  const { cards } = (await res.json()) as { cards: CatalogCard[] }
  const cardById = new Map(cards.map((c) => [c.id, c]))

  return rows
    .map((row) => {
      const card = cardById.get(row.card_id)
      if (!card) return null
      return { ...card, status: row.status }
    })
    .filter((c): c is TcgCard => c !== null)
}

export async function addCardToBinder(
  supabase: SupabaseClient,
  userId: string,
  card: CatalogCard,
  status: CardStatus,
): Promise<void> {
  const payload = {
    user_id: userId,
    card_id: card.id,
    status,
    card_name: card.name,
    card_set: card.set,
    card_image: card.image,
    card_rarity: card.rarity,
  }

  const { error: insertError } = await supabase.from("user_binders").insert(payload)

  if (!insertError) return

  // Row already exists — update status (and refresh cached card data).
  if (insertError.code === "23505") {
    const { error: updateError } = await supabase
      .from("user_binders")
      .update({
        status,
        card_name: card.name,
        card_set: card.set,
        card_image: card.image,
        card_rarity: card.rarity,
      })
      .eq("user_id", userId)
      .eq("card_id", card.id)

    if (updateError) throw updateError
    return
  }

  // Table may not have metadata columns yet — fall back to minimal insert.
  if (insertError.code === "42703" || insertError.code === "PGRST204") {
    const { error: minimalError } = await supabase.from("user_binders").insert({
      user_id: userId,
      card_id: card.id,
      status,
    })

    if (!minimalError) return

    if (minimalError.code === "23505") {
      const { error: updateError } = await supabase
        .from("user_binders")
        .update({ status })
        .eq("user_id", userId)
        .eq("card_id", card.id)
      if (updateError) throw updateError
      return
    }

    throw minimalError
  }

  throw new Error(insertError.message)
}

export async function updateBinderStatus(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  status: CardStatus,
): Promise<void> {
  const { error } = await supabase
    .from("user_binders")
    .update({ status })
    .eq("user_id", userId)
    .eq("card_id", cardId)

  if (error) throw error
}
