import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { loadCardBundle } from "@/lib/scrydex/db"
import { scrydexBundleToCardPriceRow } from "@/lib/scrydex/price-adapter"
import {
  catalogIdToLegacyPokeId,
  resolveCatalogId,
  splitCatalogId,
} from "@/lib/scrydex/constants"
import type { TcgGame } from "@/lib/scrydex/types"

export type TcgResearchCardDetail = {
  id: string
  catalogId: string | null
  scrydexId: string | null
  game: TcgGame
  name: string
  setName: string
  setId: string
  number: string
  rarity: string | null
  imageUrl: string
  rawPrice: number | null
  psa7Price: number | null
  psa8Price: number | null
  psa9Price: number | null
  psa10Price: number | null
  priceUpdatedAt: string | null
  priceTrend: "up" | "down" | "flat" | null
}

type CardsRow = {
  id: string
  name: string
  set_name: string
  set_id: string
  number: string
  rarity: string | null
  image_url: string | null
  scrydex_id: string | null
  game: string | null
  current_price_raw: number | null
  current_price_psa10: number | null
  price_updated_at: string | null
}

function trendFromPrices(raw: number | null, graded: number | null): TcgResearchCardDetail["priceTrend"] {
  if (raw == null || graded == null || raw <= 0 || graded <= 0) return null
  const spread = graded - raw
  if (spread > raw * 0.15) return "up"
  if (spread < raw * 0.05) return "down"
  return "flat"
}

function rowToDetail(row: CardsRow): TcgResearchCardDetail {
  const raw = row.current_price_raw != null ? Number(row.current_price_raw) : null
  const psa10 = row.current_price_psa10 != null ? Number(row.current_price_psa10) : null

  return {
    id: row.id,
    catalogId: row.scrydex_id ? `${row.game ?? "pokemon"}-${row.scrydex_id}` : resolveCatalogId(row.id),
    scrydexId: row.scrydex_id,
    game: (row.game ?? "pokemon") as TcgGame,
    name: row.name,
    setName: row.set_name,
    setId: row.set_id,
    number: row.number,
    rarity: row.rarity,
    imageUrl: row.image_url ?? "/placeholder.svg",
    rawPrice: raw,
    psa7Price: null,
    psa8Price: null,
    psa9Price: null,
    psa10Price: psa10,
    priceUpdatedAt: row.price_updated_at,
    priceTrend: trendFromPrices(raw, psa10),
  }
}

function bundleToDetail(bundle: Awaited<ReturnType<typeof loadCardBundle>>): TcgResearchCardDetail | null {
  if (!bundle?.card) return null

  const priceRow = scrydexBundleToCardPriceRow({
    card: bundle.card,
    raw: bundle.raw as never[],
    graded: bundle.graded as never[],
    legacyCardId: catalogIdToLegacyPokeId(bundle.card.catalog_id) ?? undefined,
  })

  const parts = splitCatalogId(bundle.card.catalog_id)

  return {
    id: priceRow?.card_id ?? catalogIdToLegacyPokeId(bundle.card.catalog_id) ?? bundle.card.catalog_id,
    catalogId: bundle.card.catalog_id,
    scrydexId: bundle.card.scrydex_id,
    game: parts?.game ?? bundle.card.game,
    name: bundle.card.name,
    setName: bundle.card.set_name,
    setId: bundle.card.set_code,
    number: bundle.card.number,
    rarity: bundle.card.rarity,
    imageUrl: bundle.card.image_large_url ?? bundle.card.image_small_url ?? "/placeholder.svg",
    rawPrice: priceRow?.raw_price ?? null,
    psa7Price: priceRow?.psa7_price ?? null,
    psa8Price: priceRow?.psa8_price ?? null,
    psa9Price: priceRow?.psa9_price ?? null,
    psa10Price: priceRow?.psa10_price ?? null,
    priceUpdatedAt: priceRow?.synced_at ?? null,
    priceTrend: trendFromPrices(priceRow?.raw_price ?? null, priceRow?.psa10_price ?? null),
  }
}

async function lookupPublicCardsRow(input: {
  id?: string
  scrydexId?: string
  catalogId?: string
  game?: TcgGame
}): Promise<TcgResearchCardDetail | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = createAdminClient()
  let query = supabase
    .from("cards")
    .select(
      "id, name, set_name, set_id, number, rarity, image_url, scrydex_id, game, current_price_raw, current_price_psa10, price_updated_at",
    )
    .limit(1)

  if (input.id) {
    query = query.eq("id", input.id)
  } else if (input.scrydexId) {
    query = query.eq("scrydex_id", input.scrydexId)
    if (input.game) query = query.eq("game", input.game)
  } else {
    return null
  }

  const { data, error } = await query.maybeSingle()
  if (error?.code === "42703" || error?.code === "42P01") return null
  if (error) throw error
  if (!data) return null

  return rowToDetail(data as CardsRow)
}

export async function resolveTcgResearchCard(input: {
  id?: string
  scrydexId?: string
  catalogId?: string
  game?: TcgGame
}): Promise<TcgResearchCardDetail | null> {
  const catalogId =
    input.catalogId ??
    (input.scrydexId && input.game ? `${input.game}-${input.scrydexId}` : null) ??
    (input.id ? resolveCatalogId(input.id) : null)

  const local =
    (await lookupPublicCardsRow({
      id: input.id,
      scrydexId: input.scrydexId,
      catalogId: catalogId ?? undefined,
      game: input.game,
    })) ??
    (input.scrydexId && !input.id
      ? await lookupPublicCardsRow({
          id: `poke-${input.scrydexId}`,
          scrydexId: input.scrydexId,
          game: input.game ?? "pokemon",
        })
      : null)

  if (local && (local.rawPrice ?? 0) > 0) return local

  if (catalogId) {
    const bundle = await loadCardBundle(catalogId)
    const fromBundle = bundleToDetail(bundle)
    if (fromBundle) return fromBundle
  }

  return local
}
