import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import { catalogHitIdForUi } from "@/lib/scrydex/constants"
import { getCatalogCard, loadCardBundle, searchLocalCatalog } from "@/lib/scrydex/db"
import { scrydexBundleToCardPriceRow } from "@/lib/scrydex/price-adapter"
import type { CatalogCardRow } from "@/lib/scrydex/types"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { CatalogCard } from "@/lib/trade-binder/cards"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"

export function catalogRowToSearchHit(
  row: CatalogCardRow,
  prices?: { rawPrice?: number; syncedAt?: string },
): CatalogSearchHit {
  return {
    id: catalogHitIdForUi(row.catalog_id),
    name: row.name,
    setName: row.set_name,
    setId: row.set_code,
    number: row.number,
    rarity: row.rarity ? mapPokemonRarity(row.rarity) : null,
    imageUrl: upgradeCardImageUrlSync(row.image_large_url ?? row.image_small_url ?? "/placeholder.svg"),
    language: (row.language_code ?? "en").toLowerCase(),
    japaneseName: null,
    rawPrice: prices?.rawPrice && prices.rawPrice > 0 ? prices.rawPrice : undefined,
    priceSyncedAt: prices?.syncedAt,
  }
}

function batchRowToSearchHit(row: Record<string, unknown>): CatalogSearchHit {
  const catalogId = String(row.catalog_id ?? "")
  const rawMarket = row.raw_market == null ? undefined : Number(row.raw_market)
  const syncedAt = row.price_synced_at ? String(row.price_synced_at) : undefined

  return {
    id: catalogHitIdForUi(catalogId),
    name: String(row.name ?? "Unknown card"),
    setName: String(row.set_name ?? "Unknown set"),
    setId: "",
    number: String(row.number ?? ""),
    rarity: null,
    imageUrl: upgradeCardImageUrlSync(String(row.image_small_url ?? "/placeholder.svg")),
    language: "en",
    japaneseName: null,
    rawPrice: rawMarket && rawMarket > 0 ? rawMarket : undefined,
    priceSyncedAt: syncedAt,
  }
}

/** Local catalog_cards search — 0 Scrydex API credits. */
export async function searchScrydexCatalogLocal(
  query: string,
  limit = 20,
): Promise<CatalogSearchHit[]> {
  if (!isSupabaseConfigured()) return []

  const q = query.trim()
  if (q.length < 2) return []

  try {
    const { cards } = await searchLocalCatalog({
      game: "pokemon",
      q,
      page: 1,
      pageSize: Math.min(Math.max(limit, 1), 80),
    })

    if (cards.length === 0) return []

    const supabase = createAdminClient()
    const catalogIds = cards.map((card) => card.catalog_id)
    const { data, error } = await supabase.rpc("get_cards_with_prices_batch", { ids: catalogIds })

    if (error?.code === "42883") {
      return cards.map((row) => catalogRowToSearchHit(row))
    }
    if (error?.code === "42P01") return []
    if (error) throw error

    const pricedByCatalogId = new Map(
      ((data ?? []) as Record<string, unknown>[]).map((row) => [String(row.catalog_id), row]),
    )

    return cards.map((row) => {
      const priced = pricedByCatalogId.get(row.catalog_id)
      if (priced) return batchRowToSearchHit(priced)
      return catalogRowToSearchHit(row)
    })
  } catch (error) {
    console.error("[scrydex/catalog-bridge] local search failed:", error)
    return []
  }
}

/** Resolve catalog metadata from local Scrydex cache — 0 API credits. */
export async function lookupScrydexCatalogById(cardId: string): Promise<CatalogSearchHit | null> {
  const catalogId = resolveCatalogId(cardId)
  if (!catalogId || !isSupabaseConfigured()) return null

  try {
    const bundle = await loadCardBundle(catalogId)
    if (!bundle) {
      const row = await getCatalogCard(catalogId)
      if (!row) return null
      return catalogRowToSearchHit(row)
    }

    const priceRow = scrydexBundleToCardPriceRow({
      card: bundle.card,
      raw: bundle.raw as Array<Record<string, unknown> & { catalog_id: string }>,
      graded: bundle.graded as Array<Record<string, unknown> & { catalog_id: string }>,
      legacyCardId: catalogHitIdForUi(catalogId),
    })

    return catalogRowToSearchHit(bundle.card, {
      rawPrice: priceRow?.raw_price ?? undefined,
      syncedAt: priceRow?.synced_at,
    })
  } catch (error) {
    console.error("[scrydex/catalog-bridge] lookup by id failed:", error)
    return null
  }
}

/** Batch binder metadata from catalog_cards — 0 API credits. */
export async function lookupScrydexCatalogCardsByIds(ids: string[]): Promise<CatalogCard[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50)
  if (unique.length === 0 || !isSupabaseConfigured()) return []

  const catalogIds = [...new Set(unique.map(resolveCatalogId).filter(Boolean) as string[])]
  if (catalogIds.length === 0) return []

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("catalog_cards")
      .select("catalog_id, name, set_name, number, rarity, image_small_url, image_large_url")
      .in("catalog_id", catalogIds)

    if (error?.code === "42P01") return []
    if (error) throw error

    return ((data ?? []) as CatalogCardRow[]).map((row) => ({
      id: catalogHitIdForUi(row.catalog_id),
      name: row.name,
      set: row.set_name,
      rarity: mapPokemonRarity(row.rarity ?? undefined),
      image: upgradeCardImageUrlSync(row.image_large_url ?? row.image_small_url ?? "/placeholder.svg"),
      cardNumber: row.number || undefined,
    }))
  } catch (error) {
    console.error("[scrydex/catalog-bridge] batch lookup failed:", error)
    return []
  }
}
