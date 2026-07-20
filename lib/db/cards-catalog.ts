import type { CardSearchHit } from "@/lib/card-lookup"
import { getRawPricesForCardIds } from "@/lib/db/priced-catalog"
import { cleanNumber, simplifyCardName } from "@/lib/slabcrack/identify-parse"
import { buildCardSlug, buildSetSlug } from "@/lib/seo/card-slugs"
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
    rawPrice: hit.rawPrice && hit.rawPrice > 0 ? hit.rawPrice : undefined,
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

export async function attachCachedPrices(rows: CatalogCardRow[]): Promise<CatalogSearchHit[]> {
  if (rows.length === 0) return []

  const rawPrices = await getRawPricesForCardIds(rows.map((row) => row.id))
  return rows.map((row) => {
    const rawPrice = rawPrices.get(row.id)
    return rowToHit({
      ...row,
      raw_price: rawPrice ?? null,
      synced_at: undefined,
      sync_error: undefined,
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

function collectorNumberMatches(stored: string, detected: string): boolean {
  const left = stored.split("/")[0] ?? stored
  return left.trim().toLowerCase() === detected.trim().toLowerCase()
}

/** Fast name + collector number lookup on the local cards table (Collectr-style). */
export async function findCatalogCandidatesForDetected(
  detected: { cardName: string; cardNumber: string },
  limit = 12,
): Promise<CatalogSearchHit[]> {
  if (!isSupabaseConfigured()) return []

  const name = simplifyCardName(detected.cardName).trim()
  const number = cleanNumber(detected.cardNumber)
  if (!number) return []

  const safeNumber = number.replace(/[%_]/g, "")

  try {
    const supabase = createReadClient()

    if (!name) {
      const { data, error } = await supabase
        .from("cards")
        .select("id, name, japanese_name, set_name, set_id, number, rarity, image_url, language, updated_at")
        .or(`number.eq.${safeNumber},number.ilike.${safeNumber}/%`)
        .order("name", { ascending: true })
        .limit(Math.min(Math.max(limit, 1), 24))

      if (error) {
        if (error.code === "42P01") return []
        throw error
      }

      const hits = await attachCachedPrices((data ?? []) as CatalogCardRow[])
      return hits.filter((hit) => collectorNumberMatches(hit.number, number))
    }

    const firstToken = name.split(/\s+/).find((t) => t.length > 2) ?? name
    const safeToken = firstToken.replace(/[%_]/g, "")
    const { data, error } = await supabase
      .from("cards")
      .select("id, name, japanese_name, set_name, set_id, number, rarity, image_url, language, updated_at")
      .or(`number.eq.${safeNumber},number.ilike.${safeNumber}/%`)
      .ilike("name", `%${safeToken}%`)
      .order("name", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 40))

    if (error) {
      if (error.code === "42P01") return []
      throw error
    }

    const hits = await attachCachedPrices((data ?? []) as CatalogCardRow[])
    return hits.filter((hit) => collectorNumberMatches(hit.number, number))
  } catch (error) {
    console.error("[cards-catalog] detected match failed:", error)
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
  set_slug?: string
  card_slug?: string
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
    set_slug: row.set_slug ?? buildSetSlug(row.set_id, row.set_name),
    card_slug: row.card_slug ?? buildCardSlug(row.name, row.number ?? ""),
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

type PricedCatalogRow = {
  cardId: string
  rawPrice: number
  syncedAt: string | null
  syncError: string | null
}

function parsePricedCatalogRows(
  pricedRows: Array<{
    card_id: unknown
    raw_price: unknown
    synced_at?: unknown
    sync_error?: unknown
  }>,
): PricedCatalogRow[] {
  return pricedRows.map((row) => ({
    cardId: String(row.card_id),
    rawPrice: Number(row.raw_price),
    syncedAt: (row.synced_at as string | null) ?? null,
    syncError: (row.sync_error as string | null) ?? null,
  }))
}

function sortPricedRowsByTarget(rows: PricedCatalogRow[], target: number): PricedCatalogRow[] {
  return [...rows].sort(
    (a, b) => Math.abs(a.rawPrice - target) - Math.abs(b.rawPrice - target),
  )
}

async function catalogHitsForPricedRows(
  pricedRows: PricedCatalogRow[],
  target: number,
  limit: number,
): Promise<CatalogSearchHit[]> {
  if (!pricedRows.length) return []

  const supabase = createReadClient()
  const sorted = sortPricedRowsByTarget(pricedRows, target).slice(0, Math.max(limit * 3, limit))
  const cardIds = sorted.map((row) => row.cardId)

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, name, japanese_name, set_name, set_id, number, rarity, image_url, language, updated_at")
    .in("id", cardIds)

  if (cardsError || !cards?.length) return []

  const priceById = new Map(sorted.map((row) => [row.cardId, row]))
  return (cards as CatalogCardRow[])
    .map((row) => {
      const cached = priceById.get(row.id)
      return rowToHit({
        ...row,
        raw_price: cached?.rawPrice,
        synced_at: cached?.syncedAt,
        sync_error: cached?.syncError,
      })
    })
    .sort((a, b) => Math.abs((a.rawPrice ?? 0) - target) - Math.abs((b.rawPrice ?? 0) - target))
    .slice(0, limit)
}

async function queryPricedCatalogRows(
  buildQuery: (
    supabase: ReturnType<typeof createReadClient>,
  ) => Promise<{
    data: Array<{
      card_id: unknown
      raw_price: unknown
      synced_at?: unknown
      sync_error?: unknown
    }> | null
    error: { message: string } | null
  }>,
): Promise<PricedCatalogRow[]> {
  const supabase = createReadClient()
  const { data, error } = await buildQuery(supabase)
  if (error || !data?.length) return []
  return parsePricedCatalogRows(data)
}

/** Cards from card_prices within a raw price band, joined to the unified cards catalog. */
export async function getCatalogCardsInPriceBand(
  min: number,
  max: number,
  target: number,
  limit: number,
): Promise<CatalogSearchHit[]> {
  if (!isSupabaseConfigured() || limit <= 0) return []

  try {
    const poolSize = Math.min(Math.max(limit * 8, 80), 500)
    const rows = await queryPricedCatalogRows((supabase) =>
      supabase
        .from("card_prices")
        .select("card_id, raw_price, synced_at, sync_error")
        .gt("raw_price", 0)
        .gte("raw_price", min)
        .lte("raw_price", max)
        .neq("sync_error", "unavailable")
        .like("card_id", "poke-%")
        .limit(poolSize),
    )

    return catalogHitsForPricedRows(rows, target, limit)
  } catch (error) {
    console.error("[cards-catalog] price band query failed:", error)
    return []
  }
}

/** Nearest priced catalog cards to a target raw price (for giveaway fallbacks). */
export async function getCatalogCardsClosestToPrice(
  target: number,
  limit: number,
): Promise<CatalogSearchHit[]> {
  if (!isSupabaseConfigured() || limit <= 0 || target <= 0) return []

  try {
    const poolSize = Math.min(Math.max(limit * 12, 120), 600)
    const spread = Math.max(target * 2, 5)
    const min = Math.max(0.01, target - spread)
    const max = target + spread

    const rows = await queryPricedCatalogRows((supabase) =>
      supabase
        .from("card_prices")
        .select("card_id, raw_price, synced_at, sync_error")
        .gt("raw_price", 0)
        .gte("raw_price", min)
        .lte("raw_price", max)
        .neq("sync_error", "unavailable")
        .like("card_id", "poke-%")
        .limit(poolSize),
    )

    return catalogHitsForPricedRows(rows, target, limit)
  } catch (error) {
    console.error("[cards-catalog] closest price query failed:", error)
    return []
  }
}
