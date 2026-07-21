import { catalogHitToCardSearchHit, type CatalogSearchHit } from "@/lib/db/cards-catalog"
import type { CardSearchHit } from "@/lib/card-lookup"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"
import { catalogHitIdForUi } from "@/lib/scrydex/constants"
import { catalogRowToSearchHit } from "@/lib/scrydex/catalog-bridge"
import type { CatalogCardRow, TcgGame } from "@/lib/scrydex/types"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"

type ScoredHit = { hit: CardSearchHit; score: number }

function cardsRowToSearchHit(row: {
  id: string
  name: string
  set_name: string
  set_id: string
  number: string
  rarity: string | null
  image_url: string | null
  scrydex_id: string | null
  current_price_raw: number | null
  current_price_psa10: number | null
}): CardSearchHit {
  const raw = Number(row.current_price_raw) || 0
  const psa10 = Number(row.current_price_psa10) || 0
  const price = raw > 0 ? raw : psa10

  return {
    id: row.id.startsWith("poke-") ? row.id : row.scrydex_id ? `poke-${row.scrydex_id}` : row.id,
    pokemonTcgId: row.scrydex_id ?? row.id.replace(/^poke-/, ""),
    cardName: row.name,
    setName: row.set_name,
    cardNumber: row.number,
    imageUrl: upgradeCardImageUrlSync(row.image_url ?? "/placeholder.svg"),
    rarity: row.rarity ? mapPokemonRarity(row.rarity) : null,
    rawPrice: price > 0 ? price : undefined,
  }
}

function catalogBatchRowToHit(row: Record<string, unknown>): CatalogSearchHit {
  const catalogId = String(row.catalog_id ?? "")
  const rawMarket = row.raw_market == null ? undefined : Number(row.raw_market)
  const psa10Market = row.psa10_market == null ? undefined : Number(row.psa10_market)
  const price =
    rawMarket && rawMarket > 0 ? rawMarket : psa10Market && psa10Market > 0 ? psa10Market : undefined

  return {
    id: catalogHitIdForUi(catalogId),
    name: String(row.name ?? "Unknown card"),
    setName: String(row.set_name ?? "Unknown set"),
    setId: String(row.set_code ?? ""),
    number: String(row.number ?? ""),
    rarity: null,
    imageUrl: upgradeCardImageUrlSync(
      String(row.image_large_url ?? row.image_small_url ?? "/placeholder.svg"),
    ),
    language: "en",
    japaneseName: null,
    rawPrice: price,
    priceSyncedAt: row.price_synced_at ? String(row.price_synced_at) : undefined,
  }
}

export function scorePopularCard(input: {
  activityHits: number
  rawPrice: number
  psa10Price: number
}): number {
  const market = Math.max(input.rawPrice, input.psa10Price, 0)
  return input.activityHits * 10_000 + market
}

export function rankPopularHits(hits: ScoredHit[], limit: number): CardSearchHit[] {
  return hits
    .sort((a, b) => b.score - a.score || (b.hit.rawPrice ?? 0) - (a.hit.rawPrice ?? 0))
    .slice(0, limit)
    .map((entry) => entry.hit)
}

async function loadPokemonPopularFromCards(limit: number): Promise<CardSearchHit[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, name, set_name, set_id, number, rarity, image_url, scrydex_id, current_price_raw, current_price_psa10, game",
    )
    .eq("game", "pokemon")
    .not("current_price_psa10", "is", null)
    .gt("current_price_psa10", 0)
    .order("current_price_psa10", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error?.code === "42703") {
    const fallback = await supabase
      .from("cards")
      .select("id, name, set_name, set_id, number, rarity, image_url")
      .like("id", "poke-%")
      .order("updated_at", { ascending: false })
      .limit(limit)

    if (fallback.error) return []
    return (fallback.data ?? []).map((row) =>
      cardsRowToSearchHit({
        ...row,
        scrydex_id: row.id.replace(/^poke-/, ""),
        current_price_raw: null,
        current_price_psa10: null,
      }),
    )
  }

  if (error) throw error
  return (data ?? []).map((row) => cardsRowToSearchHit(row))
}

async function loadCatalogPopular(game: TcgGame, limit: number): Promise<CardSearchHit[]> {
  const supabase = createAdminClient()
  const fetchLimit = Math.min(Math.max(limit * 3, limit), 400)

  const { data: catalogRows, error: catalogError } = await supabase
    .from("catalog_cards")
    .select(
      "catalog_id, game, scrydex_id, name, set_name, set_code, number, rarity, image_small_url, image_large_url",
    )
    .eq("game", game)
    .limit(fetchLimit)

  if (catalogError?.code === "42P01") return []
  if (catalogError) throw catalogError
  if (!catalogRows?.length) return []

  const catalogIds = catalogRows.map((row) => String(row.catalog_id))

  const activityByCatalog = new Map<string, number>()
  const { data: activityRows } = await supabase
    .from("card_activity")
    .select("catalog_id, hit_count")
    .in("catalog_id", catalogIds)

  for (const row of activityRows ?? []) {
    const id = String(row.catalog_id)
    activityByCatalog.set(id, (activityByCatalog.get(id) ?? 0) + Number(row.hit_count ?? 0))
  }

  const priceByCatalog = new Map<
    string,
    { raw?: number; psa10?: number; syncedAt?: string; row: CatalogCardRow }
  >()

  const { data: batchRows, error: batchError } = await supabase.rpc("get_cards_with_prices_batch", {
    ids: catalogIds,
  })

  if (batchError?.code === "42883") {
    for (const row of catalogRows) {
      const catalogId = String(row.catalog_id)
      priceByCatalog.set(catalogId, {
        row: row as CatalogCardRow,
      })
    }
  } else if (batchError) {
    throw batchError
  } else {
    for (const row of batchRows ?? []) {
      const catalogId = String((row as Record<string, unknown>).catalog_id)
      const raw = Number((row as Record<string, unknown>).raw_market ?? 0)
      const psa10 = Number((row as Record<string, unknown>).psa10_market ?? 0)
      const catalogRow = catalogRows.find((c) => c.catalog_id === catalogId)
      if (!catalogRow) continue
      priceByCatalog.set(catalogId, {
        raw: raw > 0 ? raw : undefined,
        psa10: psa10 > 0 ? psa10 : undefined,
        syncedAt: (row as Record<string, unknown>).price_synced_at
          ? String((row as Record<string, unknown>).price_synced_at)
          : undefined,
        row: catalogRow as CatalogCardRow,
      })
    }
  }

  const scored: ScoredHit[] = []

  for (const row of catalogRows) {
    const catalogId = String(row.catalog_id)
    const priced = priceByCatalog.get(catalogId)
    const rawPrice = priced?.raw ?? 0
    const psa10Price = priced?.psa10 ?? 0
    const activityHits = activityByCatalog.get(catalogId) ?? 0

    if (rawPrice <= 0 && psa10Price <= 0 && activityHits <= 0) continue

    const hit = catalogHitToCardSearchHit(
      priced?.row
        ? catalogRowToSearchHit(priced.row, {
            rawPrice: rawPrice > 0 ? rawPrice : psa10Price,
            syncedAt: priced.syncedAt,
          })
        : catalogBatchRowToHit({
            catalog_id: catalogId,
            name: row.name,
            set_name: row.set_name,
            set_code: row.set_code,
            number: row.number,
            image_small_url: row.image_small_url,
            image_large_url: row.image_large_url,
            raw_market: rawPrice,
            psa10_market: psa10Price,
          }),
    )

    scored.push({
      hit,
      score: scorePopularCard({ activityHits, rawPrice, psa10Price }),
    })
  }

  const ranked = rankPopularHits(scored, limit)
  if (ranked.length >= Math.min(limit, 10)) return ranked

  const supplemental = catalogRows
    .slice(0, limit)
    .map((row) =>
      catalogHitToCardSearchHit(
        catalogRowToSearchHit(row as CatalogCardRow, {
          rawPrice: undefined,
        }),
      ),
    )

  const byId = new Map<string, CardSearchHit>()
  for (const hit of [...ranked, ...supplemental]) {
    if (!byId.has(hit.id)) byId.set(hit.id, hit)
  }
  return [...byId.values()].slice(0, limit)
}

/** Top popular cards for a TCG Research tab (activity-weighted, price fallback). */
export async function getPopularTcgResearchCards(
  game: TcgGame,
  limit = TOP_CARDS_LIMIT,
): Promise<CardSearchHit[]> {
  if (!isSupabaseConfigured()) return []

  try {
    if (game === "pokemon") {
      const fromCards = await loadPokemonPopularFromCards(limit)
      if (fromCards.length >= Math.min(limit, 10)) return fromCards.slice(0, limit)
    }

    const fromCatalog = await loadCatalogPopular(game, limit)
    if (fromCatalog.length > 0) return fromCatalog

    if (game === "pokemon") {
      return loadPokemonPopularFromCards(limit)
    }

    return []
  } catch (error) {
    console.warn("[tcg-research/popular] load failed:", game, error)
    return []
  }
}
