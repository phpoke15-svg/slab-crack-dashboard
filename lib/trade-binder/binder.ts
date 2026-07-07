import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import type { CardStatus, CatalogCard, Rarity, TcgCard } from "@/lib/trade-binder/cards"
import { binderErrorMessage } from "@/lib/trade-binder/errors"

function throwBinderError(error: PostgrestError): never {
  throw new Error(binderErrorMessage(error, "Binder operation failed"))
}

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
  const pageSize = 1000
  let from = 0
  const all: UserBinderRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from("user_binders")
      .select("*")
      .eq("user_id", userId)
      .range(from, from + pageSize - 1)

    if (error) throwBinderError(error)
    if (!data?.length) break

    all.push(...(data as UserBinderRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

export async function loadBinderCards(supabase: SupabaseClient, userId: string): Promise<TcgCard[]> {
  const rows = await fetchUserBinder(supabase, userId)
  if (rows.length === 0) return []

  const fromDb = rows.map(rowToCard).filter((c): c is TcgCard => c !== null)
  const missingMeta = rows.filter((r) => !r.card_name)

  let cards: TcgCard[]
  if (missingMeta.length === 0) {
    cards = fromDb
  } else {
    const enriched = await enrichBinderCards(missingMeta)
    cards = [...fromDb, ...enriched]
  }

  return enrichBinderCardImages(cards)
}

async function enrichBinderCardImages(cards: TcgCard[]): Promise<TcgCard[]> {
  const needsImage = cards.filter((card) => !card.image || card.image.includes("placeholder"))
  if (needsImage.length === 0) return cards

  try {
    const res = await fetch("/api/binder/enrich-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: needsImage.map((card) => ({
          id: card.id,
          name: card.name,
          set: card.set,
          image: card.image,
          rarity: card.rarity,
          cardNumber: card.name.match(/#(\d+[a-zA-Z/-]*)/)?.[1],
        })),
      }),
    })
    if (!res.ok) return cards

    const data = (await res.json()) as { cards?: Array<{ id: string; image?: string }> }
    const imageById = new Map((data.cards ?? []).map((card) => [card.id, card.image]))

    return cards.map((card) => {
      const image = imageById.get(card.id)
      return image ? { ...card, image } : card
    })
  } catch {
    return cards
  }
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

  if (error) throwBinderError(error)
}

export async function clearUserBinder(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from("user_binders").delete().eq("user_id", userId)
  if (error) throwBinderError(error)
}

export async function removeCardFromBinder(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_binders")
    .delete()
    .eq("user_id", userId)
    .eq("card_id", cardId)

  if (error) throwBinderError(error)
}

const BULK_INSERT_BATCH = 40

function dedupeCards(cards: CatalogCard[], skipIds: Set<string>): CatalogCard[] {
  const seen = new Set<string>()
  const unique: CatalogCard[] = []

  for (const card of cards) {
    if (skipIds.has(card.id) || seen.has(card.id)) continue
    seen.add(card.id)
    unique.push(card)
  }

  return unique
}

function binderInsertRows(
  userId: string,
  cards: CatalogCard[],
  status: CardStatus,
  minimal = false,
) {
  return cards.map((card) =>
    minimal
      ? { user_id: userId, card_id: card.id, status }
      : {
          user_id: userId,
          card_id: card.id,
          status,
          card_name: card.name,
          card_set: card.set,
          card_image: card.image,
          card_rarity: card.rarity,
        },
  )
}

async function insertBinderBatch(
  supabase: SupabaseClient,
  userId: string,
  cards: CatalogCard[],
  status: CardStatus,
): Promise<void> {
  const fullBatch = binderInsertRows(userId, cards, status)
  const { error } = await supabase.from("user_binders").insert(fullBatch, {
    ignoreDuplicates: true,
  })

  if (!error) return

  if (error.code === "42703" || error.code === "PGRST204") {
    const minimalBatch = binderInsertRows(userId, cards, status, true)
    const { error: minimalError } = await supabase.from("user_binders").insert(minimalBatch, {
      ignoreDuplicates: true,
    })
    if (!minimalError) return
    throwBinderError(minimalError)
  }

  throwBinderError(error)
}

export async function bulkAddCardsToBinder(
  supabase: SupabaseClient,
  userId: string,
  cards: CatalogCard[],
  status: CardStatus,
  options?: { skipIds?: Set<string> },
): Promise<{ added: number; skipped: number }> {
  const skipIds = options?.skipIds ?? new Set<string>()
  const toInsert = dedupeCards(cards, skipIds)

  if (toInsert.length === 0) {
    return { added: 0, skipped: cards.length }
  }

  for (let i = 0; i < toInsert.length; i += BULK_INSERT_BATCH) {
    const batch = toInsert.slice(i, i + BULK_INSERT_BATCH)
    await insertBinderBatch(supabase, userId, batch, status)
  }

  return { added: toInsert.length, skipped: cards.length - toInsert.length }
}
