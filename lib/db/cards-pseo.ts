import {
  getCatalogCardById,
  type CatalogCardRow,
  type CatalogSearchHit,
} from "@/lib/db/cards-catalog"
import { getCardPriceById } from "@/lib/pricing/db"
import type { CardPriceRow } from "@/lib/pricing/types"
import { buildCardSlug, buildSetSlug } from "@/lib/seo/card-slugs"
import { createReadClient, isSupabaseConfigured } from "@/lib/supabase/server"

const SITEMAP_CHUNK_SIZE = 45_000

export type CardSitemapRow = {
  setSlug: string
  cardSlug: string
  lastModified: string
}

export type CardPseoPageData = {
  card: CatalogSearchHit
  price: CardPriceRow | null
  soldCompCount: number
  setSlug: string
  cardSlug: string
}

function rowToSlugs(row: CatalogCardRow): { setSlug: string; cardSlug: string } {
  const setSlug =
    (row as CatalogCardRow & { set_slug?: string }).set_slug ??
    buildSetSlug(row.set_id, row.set_name)
  const cardSlug =
    (row as CatalogCardRow & { card_slug?: string }).card_slug ??
    buildCardSlug(row.name, row.number)
  return { setSlug, cardSlug }
}

const CARD_SELECT =
  "id, name, japanese_name, set_name, set_id, number, rarity, image_url, language, updated_at, set_slug, card_slug"

export async function getCardBySlugs(
  setSlug: string,
  cardSlug: string,
): Promise<CatalogSearchHit | null> {
  if (!isSupabaseConfigured()) return null

  const normalizedSet = setSlug.trim().toLowerCase()
  const normalizedCard = cardSlug.trim().toLowerCase()
  if (!normalizedSet || !normalizedCard) return null

  try {
    const supabase = createReadClient()
    const { data, error } = await supabase
      .from("cards")
      .select(CARD_SELECT)
      .eq("set_slug", normalizedSet)
      .eq("card_slug", normalizedCard)
      .maybeSingle()

    if (error) {
      if (error.code === "42P01" || error.code === "42703") {
        return getCardBySlugsFallback(normalizedSet, normalizedCard)
      }
      throw error
    }
    if (!data) return getCardBySlugsFallback(normalizedSet, normalizedCard)

    return getCatalogCardById((data as CatalogCardRow).id)
  } catch (error) {
    console.error("[cards-pseo] slug lookup failed:", error)
    return null
  }
}

async function getCardBySlugsFallback(
  setSlug: string,
  cardSlug: string,
): Promise<CatalogSearchHit | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createReadClient()
    const { data, error } = await supabase
      .from("cards")
      .select(CARD_SELECT.replace(", set_slug, card_slug", ""))
      .limit(5000)

    if (error || !data?.length) return null

    for (const row of data as CatalogCardRow[]) {
      const slugs = rowToSlugs(row)
      if (slugs.setSlug === setSlug && slugs.cardSlug === cardSlug) {
        return getCatalogCardById(row.id)
      }
    }
    return null
  } catch {
    return null
  }
}

export async function getRecentSoldCompCount(cardId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0

  try {
    const supabase = createReadClient()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from("price_history")
      .select("sale_count")
      .eq("card_id", cardId)
      .eq("grade", 0)
      .gte("snapshot_date", since)

    if (error) {
      if (error.code === "42P01") return 0
      return 0
    }

    const total = (data ?? []).reduce((sum, row) => {
      const count = row.sale_count == null ? 1 : Number(row.sale_count)
      return sum + (Number.isFinite(count) && count > 0 ? count : 1)
    }, 0)

    return total
  } catch {
    return 0
  }
}

export async function loadCardPseoPageData(
  setSlug: string,
  cardSlug: string,
): Promise<CardPseoPageData | null> {
  const card = await getCardBySlugs(setSlug, cardSlug)
  if (!card) return null

  const [price, soldCompCount] = await Promise.all([
    getCardPriceById(card.id),
    getRecentSoldCompCount(card.id),
  ])

  const slugs = rowToSlugs({
    id: card.id,
    name: card.name,
    japanese_name: card.japaneseName,
    set_name: card.setName,
    set_id: card.setId,
    number: card.number,
    rarity: card.rarity,
    image_url: card.imageUrl,
    language: card.language,
    updated_at: card.priceSyncedAt ?? new Date().toISOString(),
  })

  return {
    card,
    price,
    soldCompCount,
    setSlug: slugs.setSlug,
    cardSlug: slugs.cardSlug,
  }
}

export async function getCardSitemapChunkCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  try {
    const supabase = createReadClient()
    const { count, error } = await supabase.from("cards").select("*", { count: "exact", head: true })
    if (error) {
      if (error.code === "42P01") return 0
      throw error
    }
    return Math.ceil((count ?? 0) / SITEMAP_CHUNK_SIZE)
  } catch {
    return 0
  }
}

export async function listCardSitemapRows(
  chunkIndex: number,
  chunkSize = SITEMAP_CHUNK_SIZE,
): Promise<CardSitemapRow[]> {
  if (!isSupabaseConfigured()) return []

  const from = chunkIndex * chunkSize
  const to = from + chunkSize - 1

  try {
    const supabase = createReadClient()
    const selectWithSlugs =
      "id, set_id, set_name, name, number, updated_at, set_slug, card_slug"
    let query = supabase
      .from("cards")
      .select(selectWithSlugs)
      .order("id", { ascending: true })
      .range(from, to)

    let { data, error } = await query

    if (error?.code === "42703") {
      const fallback = await supabase
        .from("cards")
        .select("id, set_id, set_name, name, number, updated_at")
        .order("id", { ascending: true })
        .range(from, to)
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      if (error.code === "42P01") return []
      throw error
    }

    const rows = (data ?? []) as Array<
      CatalogCardRow & { set_slug?: string; card_slug?: string; card_prices?: { synced_at?: string } }
    >
    const cardIds = rows.map((row) => row.id)
    const priceSynced = new Map<string, string>()

    if (cardIds.length > 0) {
      const { data: prices } = await supabase
        .from("card_prices")
        .select("card_id, synced_at")
        .in("card_id", cardIds)

      for (const row of prices ?? []) {
        if (row.synced_at) priceSynced.set(String(row.card_id), String(row.synced_at))
      }
    }

    return rows.map((row) => {
      const { setSlug, cardSlug } = rowToSlugs(row)
      return {
        setSlug,
        cardSlug,
        lastModified: priceSynced.get(row.id) ?? row.updated_at,
      }
    })
  } catch (error) {
    console.error("[cards-pseo] sitemap chunk failed:", error)
    return []
  }
}

export { SITEMAP_CHUNK_SIZE }
