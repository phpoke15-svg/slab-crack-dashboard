import type { CardSearchHit } from "@/lib/card-lookup"
import { getCardPricesForIds } from "@/lib/pricing/db"
import { createAdminClient, createReadClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import type { CatalogCard } from "@/lib/trade-binder/cards"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"
import type { Rarity } from "@/lib/trade-binder/cards"

export type CatalogCardRow = {
  id: string
  name: string
  japanese_name: string | null
  set_name: string
  set_id: string
  number: string
  rarity: string | null
  image_url: string | null
  language: string
  updated_at: string
}

export type CatalogSearchHit = {
  id: string
  name: string
  setName: string
  setId: string
  number: string
  rarity: Rarity | null
  imageUrl: string
  language: string
  japaneseName: string | null
  rawPrice?: number
  priceSyncedAt?: string
  priceUnavailable?: boolean
}

export function catalogPokemonTcgId(cardId: string): string {
  return cardId.startsWith("poke-") ? cardId.slice("poke-".length) : cardId
}

export function catalogHitToCardSearchHit(hit: CatalogSearchHit): CardSearchHit {
  return {
    id: hit.id,
    pokemonTcgId: catalogPokemonTcgId(hit.id),
    cardName: hit.name,
    setName: hit.setName,
    cardNumber: hit.number,
    imageUrl: hit.imageUrl,
    rarity: hit.rarity,
  }
}

export function catalogHitToBinderCard(hit: CatalogSearchHit): CatalogCard & {
  rawPrice?: number
  cardNumber?: string
} {
  return {
    id: hit.id,
    name: hit.name,
    set: hit.setName,
    rarity: mapPokemonRarity(hit.rarity ?? undefined),
    image: upgradeCardImageUrlSync(hit.imageUrl),
    cardNumber: hit.number || undefined,
    rawPrice: hit.rawPrice,
  }
}

async function attachCachedPrices(rows: CatalogCardRow[]): Promise<CatalogSearchHit[]> {
  if (rows.length === 0) return []

  const prices = await getCardPricesForIds(rows.map((row) => row.id))
  return rows.map((row) => {
    const cached = prices.get(row.id)
    return rowToHit({
      ...row,
      raw_price: cached?.raw_price,
      synced_at: cached?.synced_at,
      sync_error: cached?.sync_error,
    })
  })
}

function rowToHit(
  row: CatalogCardRow & { raw_price?: number | null; synced_at?: string | null; sync_error?: string | null },
): CatalogSearchHit {
  const rawPrice = row.raw_price != null ? Number(row.raw_price) : undefined
  const syncedAt = row.synced_at ?? undefined
  const unavailable = row.sync_error === "unavailable"

  return {
    id: row.id,
    name: row.name,
    setName: row.set_name,
    setId: row.set_id,
    number: row.number,
    rarity: row.rarity ? mapPokemonRarity(row.rarity) : null,
    imageUrl: row.image_url ?? "/placeholder.svg",
    language: row.language,
    japaneseName: row.japanese_name,
    rawPrice: rawPrice && rawPrice > 0 ? rawPrice : undefined,
    priceSyncedAt: syncedAt,
    priceUnavailable: unavailable && syncedAt ? true : undefined,
  }
}

export async function getCatalogCardCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0

  try {
    const supabase = createReadClient()
    const { count, error } = await supabase.from("cards").select("*", { count: "exact", head: true })
    if (error) {
      if (error.code === "42P01") return 0
      throw error
    }
    return count ?? 0
  } catch (error) {
    console.error("[cards-catalog] count failed:", error)
    return 0
  }
}

export async function getCatalogCardById(cardId: string): Promise<CatalogSearchHit | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createReadClient()
    const { data, error } = await supabase
      .from("cards")
      .select("id, name, japanese_name, set_name, set_id, number, rarity, image_url, language, updated_at")
      .eq("id", cardId)
      .maybeSingle()

    if (error) {
      if (error.code === "42P01") return null
      throw error
    }
    if (!data) return null

    const [hit] = await attachCachedPrices([data as CatalogCardRow])
    return hit ?? null
  } catch (error) {
    console.error("[cards-catalog] get by id failed:", error)
    return null
  }
}

export async function searchCatalogCardsLocal(
  query: string,
  limit = 20,
): Promise<CatalogSearchHit[]> {
  if (!isSupabaseConfigured()) return []

  const q = query.trim()
  if (q.length < 2) return []

  try {
    const supabase = createReadClient()
    const pattern = `%${q.replace(/[%_]/g, "")}%`
    const { data, error } = await supabase
      .from("cards")
      .select("id, name, japanese_name, set_name, set_id, number, rarity, image_url, language, updated_at")
      .or(
        `name.ilike.${pattern},japanese_name.ilike.${pattern},set_name.ilike.${pattern},number.ilike.${pattern}`,
      )
      .order("name", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 80))

    if (error) {
      if (error.code === "42P01") return []
      throw error
    }

    return attachCachedPrices((data ?? []) as CatalogCardRow[])
  } catch (error) {
    console.error("[cards-catalog] search failed:", error)
    return []
  }
}

export type CatalogCardUpsert = {
  id: string
  name: string
  japanese_name?: string | null
  set_name: string
  set_id: string
  number: string
  rarity?: string | null
  image_url?: string | null
  language?: string
}

export async function upsertCatalogCards(rows: CatalogCardUpsert[]): Promise<number> {
  if (!isSupabaseConfigured() || rows.length === 0) return 0

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const payload = rows.map((row) => ({
    id: row.id,
    name: row.name,
    japanese_name: row.japanese_name ?? null,
    set_name: row.set_name,
    set_id: row.set_id,
    number: row.number ?? "",
    rarity: row.rarity ?? null,
    image_url: row.image_url ?? null,
    language: row.language ?? "en",
    updated_at: now,
  }))

  const { error } = await supabase.from("cards").upsert(payload, { onConflict: "id" })
  if (error) throw error
  return payload.length
}

const FEATURED_NAME_QUERIES = ["charizard", "pikachu", "mew", "umbreon", "lugia", "rayquaza"]

export async function getFeaturedCatalogCards(limit = 30): Promise<CatalogSearchHit[]> {
  if (!isSupabaseConfigured()) return []

  try {
    const supabase = createReadClient()
    const { data: pricedRows, error: priceError } = await supabase
      .from("card_prices")
      .select("card_id, raw_price, synced_at, sync_error")
      .gt("raw_price", 0)
      .like("card_id", "poke-%")
      .order("raw_price", { ascending: false })
      .limit(Math.min(limit * 2, 80))

    if (!priceError && pricedRows?.length) {
      const cardIds = pricedRows.map((row) => String(row.card_id))
      const { data: cards, error: cardsError } = await supabase
        .from("cards")
        .select("id, name, japanese_name, set_name, set_id, number, rarity, image_url, language, updated_at")
        .in("id", cardIds)

      if (!cardsError && cards?.length) {
        const priceById = new Map(
          pricedRows.map((row) => [
            String(row.card_id),
            {
              raw_price: row.raw_price,
              synced_at: row.synced_at,
              sync_error: row.sync_error,
            },
          ]),
        )

        const hits = (cards as CatalogCardRow[])
          .map((row) => {
            const cached = priceById.get(row.id)
            return rowToHit({
              ...row,
              raw_price: cached?.raw_price as number | null | undefined,
              synced_at: cached?.synced_at as string | null | undefined,
              sync_error: cached?.sync_error as string | null | undefined,
            })
          })
          .sort((a, b) => (b.rawPrice ?? 0) - (a.rawPrice ?? 0))

        if (hits.length > 0) return hits.slice(0, limit)
      }
    }

    const merged: CatalogSearchHit[] = []
    const seen = new Set<string>()
    for (const query of FEATURED_NAME_QUERIES) {
      const hits = await searchCatalogCardsLocal(query, 8)
      for (const hit of hits) {
        if (seen.has(hit.id)) continue
        seen.add(hit.id)
        merged.push(hit)
      }
      if (merged.length >= limit) break
    }

    return merged.slice(0, limit)
  } catch (error) {
    console.error("[cards-catalog] featured failed:", error)
    return []
  }
}
