import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { bestKnownImageUrl, upgradeCardImageUrlSync } from "@/lib/card-image-url"
import type { CardStatus, CatalogCard, Rarity, TcgCard } from "@/lib/trade-binder/cards"
import { catalogCardsByStoredId, lookupCatalogCardsByIds } from "@/lib/trade-binder/catalog-batch"
import { binderErrorMessage } from "@/lib/trade-binder/errors"

function throwBinderError(error: PostgrestError): never {
  throw new Error(binderErrorMessage(error, "Binder operation failed"))
}

export type UserBinderRow = {
  id: string
  card_id: string
  status: CardStatus
  card_name?: string | null
  card_set?: string | null
  card_image?: string | null
  card_rarity?: string | null
  card_number?: string | null
}

function binderCardKey(card: Pick<TcgCard, "clientKey">): string {
  return card.clientKey
}

function createClientKey(entryId?: string): string {
  if (entryId) return entryId
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function withClientKey(card: Omit<TcgCard, "clientKey"> & { clientKey?: string }): TcgCard {
  return {
    ...card,
    clientKey: card.clientKey ?? card.entryId ?? createClientKey(),
  }
}

export function dedupeBinderCards(cards: TcgCard[]): TcgCard[] {
  const byCatalogId = new Map<string, TcgCard>()

  for (const card of cards) {
    const normalized = withClientKey(card)
    const existing = byCatalogId.get(normalized.id)
    if (!existing) {
      byCatalogId.set(normalized.id, normalized)
      continue
    }
    if (!existing.entryId && normalized.entryId) {
      byCatalogId.set(normalized.id, {
        ...normalized,
        clientKey: existing.clientKey,
      })
    }
  }

  return Array.from(byCatalogId.values())
}

async function findBinderEntryId(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("user_binders")
    .select("id")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .maybeSingle()

  if (error) throwBinderError(error)
  if (!data?.id) throw new Error("Binder entry not found after save")
  return data.id
}

function stripPokemonApiId(cardId: string): string {
  return cardId.startsWith("poke-") ? cardId.slice("poke-".length) : cardId
}

function cardNumberFromId(cardId: string): string {
  if (cardId.startsWith("pc-") || cardId.startsWith("poke-")) return ""
  const match = cardId.match(/-(\d+[a-z]?)$/i)
  return match?.[1] ?? ""
}

function rowToCard(row: UserBinderRow): TcgCard | null {
  if (!row.card_id?.trim()) return null
  const image = upgradeCardImageUrlSync(row.card_image ?? "/placeholder.svg")
  return {
    entryId: row.id,
    clientKey: row.id,
    id: row.card_id,
    name: row.card_name?.trim() || "Unknown card",
    set: row.card_set?.trim() || "Unknown Set",
    image,
    rarity: (row.card_rarity as Rarity) ?? "Common",
    status: row.status,
    cardNumber: row.card_number ?? (cardNumberFromId(row.card_id) || undefined),
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

function withSyncedImages(cards: TcgCard[]): TcgCard[] {
  return cards.map((card) => {
    const image = upgradeCardImageUrlSync(card.image)
    return image !== card.image ? { ...card, image } : card
  })
}

function rowMissingMeta(row: UserBinderRow): boolean {
  return !row.card_name?.trim() || !row.card_set?.trim()
}

export async function loadBinderCards(supabase: SupabaseClient, userId: string): Promise<TcgCard[]> {
  const rows = await fetchUserBinder(supabase, userId)
  if (rows.length === 0) return []

  const missingMeta = rows.filter(rowMissingMeta)
  const completeRows = rows.filter((r) => !rowMissingMeta(r))

  const fromDb = completeRows.map(rowToCard).filter((c): c is TcgCard => c !== null)

  let cards: TcgCard[]
  if (missingMeta.length === 0) {
    cards = fromDb
  } else {
    const enriched = await enrichBinderCards(missingMeta)
    const enrichedIds = new Set(enriched.map((c) => c.id))
    const fallback = missingMeta
      .filter((row) => !enrichedIds.has(row.card_id))
      .map(rowToCard)
      .filter((c): c is TcgCard => c !== null)
    cards = [...fromDb, ...enriched, ...fallback]
  }

  return dedupeBinderCards(withSyncedImages(cards))
}

const PRICE_CHUNK = 20
const DEFAULT_PRICE_ENRICH_LIMIT = 80

/** Fetch prices for binder cards without blocking the initial binder load. */
export async function enrichBinderCardPrices(
  cards: TcgCard[],
  limit = DEFAULT_PRICE_ENRICH_LIMIT,
): Promise<TcgCard[]> {
  const unpriced = cards.filter((card) => !card.rawPrice || card.rawPrice <= 0).slice(0, limit)
  if (unpriced.length === 0) return cards

  const priceById = new Map<string, number>()

  try {
    const chunks: (typeof unpriced)[] = []
    for (let i = 0; i < unpriced.length; i += PRICE_CHUNK) {
      chunks.push(unpriced.slice(i, i + PRICE_CHUNK))
    }

    const responses = await Promise.all(
      chunks.map((chunk) =>
        fetch("/api/binder/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cards: chunk.map((card) => ({
              id: card.id,
              name: card.name,
              set: card.set,
              cardNumber: card.cardNumber ?? card.name.match(/#(\d+[a-zA-Z/-]*)/)?.[1],
            })),
          }),
        }),
      ),
    )

    for (const res of responses) {
      if (!res.ok) continue
      const data = (await res.json()) as { prices?: Record<string, number> }
      for (const [id, price] of Object.entries(data.prices ?? {})) {
        if (price > 0) priceById.set(id, price)
      }
    }
  } catch {
    return cards
  }

  if (priceById.size === 0) return cards

  return cards.map((card) => {
    const price = priceById.get(card.id)
    return price ? { ...card, rawPrice: price } : card
  })
}

export async function enrichBinderCards(rows: UserBinderRow[]): Promise<TcgCard[]> {
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.card_id).filter(Boolean)
  let catalogCards: CatalogCard[] = []

  if (typeof window === "undefined") {
    catalogCards = await lookupCatalogCardsByIds(ids)
  } else {
    const res = await fetch(`/api/binder/batch?ids=${encodeURIComponent(ids.join(","))}`)
    if (!res.ok) return []
    const data = (await res.json()) as { cards?: CatalogCard[] }
    catalogCards = data.cards ?? []
  }

  const cardById = catalogCardsByStoredId(catalogCards)
  const enriched: TcgCard[] = []

  for (const row of rows) {
    if (!row.card_id?.trim()) continue
    const card =
      cardById.get(row.card_id) ?? cardById.get(stripPokemonApiId(row.card_id))
    if (!card) continue
    const image = upgradeCardImageUrlSync(card.image)
    enriched.push({
      ...card,
      image,
      entryId: row.id,
      clientKey: row.id,
      id: row.card_id,
      status: row.status,
      cardNumber: row.card_number ?? (cardNumberFromId(row.card_id) || undefined),
    })
  }

  return enriched
}

function binderSavePayload(
  userId: string,
  card: CatalogCard & { cardNumber?: string },
  status: CardStatus,
  minimal = false,
) {
  const image = bestKnownImageUrl(card.image) ?? upgradeCardImageUrlSync(card.image)
  const cardNumber = card.cardNumber ?? (cardNumberFromId(card.id) || null)

  if (minimal) {
    return { user_id: userId, card_id: card.id, status }
  }

  return {
    user_id: userId,
    card_id: card.id,
    status,
    card_name: card.name,
    card_set: card.set,
    card_image: image,
    card_rarity: card.rarity,
    card_number: cardNumber,
  }
}

export async function addCardToBinder(
  supabase: SupabaseClient,
  userId: string,
  card: CatalogCard & { cardNumber?: string },
  status: CardStatus,
): Promise<string> {
  const payload = binderSavePayload(userId, card, status)

  const { data: inserted, error: insertError } = await supabase
    .from("user_binders")
    .insert(payload)
    .select("id")
    .single()

  if (!insertError) {
    if (!inserted?.id) throw new Error("Binder entry not found after save")
    return inserted.id
  }

  // Row already exists — update status (and refresh cached card data).
  if (insertError.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("user_binders")
      .select("status, pending_trade_id")
      .eq("user_id", userId)
      .eq("card_id", card.id)
      .maybeSingle()

    if (existingError) throw existingError
    if (existing?.status === "pending" && existing.pending_trade_id) {
      throw new Error("This card is locked in an accepted trade.")
    }

    const { error: updateError } = await supabase
      .from("user_binders")
      .update({
        status,
        card_name: card.name,
        card_set: card.set,
        card_image: payload.card_image,
        card_rarity: card.rarity,
        card_number: payload.card_number,
      })
      .eq("user_id", userId)
      .eq("card_id", card.id)

    if (updateError) throw updateError
    return findBinderEntryId(supabase, userId, card.id)
  }

  // Table may not have metadata columns yet — fall back to minimal insert.
  if (insertError.code === "42703" || insertError.code === "PGRST204") {
    const { data: minimalInserted, error: minimalError } = await supabase
      .from("user_binders")
      .insert(binderSavePayload(userId, card, status, true))
      .select("id")
      .single()

    if (!minimalError) {
      if (!minimalInserted?.id) throw new Error("Binder entry not found after save")
      return minimalInserted.id
    }

    if (minimalError.code === "23505") {
      const { error: updateError } = await supabase
        .from("user_binders")
        .update({ status })
        .eq("user_id", userId)
        .eq("card_id", card.id)
      if (updateError) throw updateError
      return findBinderEntryId(supabase, userId, card.id)
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
  if (status !== "pending") {
    const { data: existing, error: existingError } = await supabase
      .from("user_binders")
      .select("status, pending_trade_id")
      .eq("user_id", userId)
      .eq("card_id", cardId)
      .maybeSingle()

    if (existingError) throwBinderError(existingError)
    if (existing?.status === "pending" && existing.pending_trade_id) {
      throw new Error("This card is locked in an accepted trade.")
    }
  }

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

export async function removeBinderEntry(
  supabase: SupabaseClient,
  userId: string,
  entryId: string,
): Promise<void> {
  const trimmed = entryId.trim()
  if (!trimmed) throw new Error("Cannot remove binder entry without a row id")

  const { error } = await supabase
    .from("user_binders")
    .delete()
    .eq("user_id", userId)
    .eq("id", trimmed)

  if (error) throwBinderError(error)
}

export async function removeCardFromBinder(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
): Promise<void> {
  const trimmed = cardId.trim()
  if (!trimmed) throw new Error("Cannot remove binder card without a card id")

  const { error } = await supabase
    .from("user_binders")
    .delete()
    .eq("user_id", userId)
    .eq("card_id", trimmed)

  if (error) throwBinderError(error)
}

export { binderCardKey, withClientKey }

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
