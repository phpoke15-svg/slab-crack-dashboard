import { catalogHitToCardSearchHit, type CatalogSearchHit } from "@/lib/db/cards-catalog"
import type { CardSearchHit } from "@/lib/card-lookup"
import { getTopSlabItCards } from "@/lib/db/top-ranked-cards"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"
import { catalogHitIdForUi } from "@/lib/scrydex/constants"
import { catalogRowToSearchHit } from "@/lib/scrydex/catalog-bridge"
import type { CatalogCardRow, TcgGame } from "@/lib/scrydex/types"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { isSlabItEligibleRelease, SLABIT_MAX_SET_AGE_YEARS } from "@/lib/slabit-config"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"

/** Trending feed only surfaces sets released within this window (matches SlabIt modern scope). */
export const TCG_RESEARCH_TRENDING_SET_AGE_YEARS = SLABIT_MAX_SET_AGE_YEARS

const VINTAGE_SET_NAME_PATTERNS = [
  /legendary collection/i,
  /\bbase set\b/i,
  /^neo /i,
  /\bexpedition\b/i,
  /\baquapolis\b/i,
  /\bskyridge\b/i,
  /\bnintendo promos\b/i,
  /\bwizards black star/i,
  /\bpop series\b/i,
]

const MODERN_SET_ID_PREFIXES = ["sv", "swsh", "me", "sm12", "sm11", "sm10", "sm9", "sm8"]

type ScoredHit = { hit: CardSearchHit; score: number }

type PokemonCardRow = {
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
}

function cardsRowToSearchHit(row: PokemonCardRow): CardSearchHit {
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

function catalogIdFromPokemonRow(row: Pick<PokemonCardRow, "id" | "scrydex_id">): string | null {
  if (row.scrydex_id) return `pokemon-${row.scrydex_id}`
  if (row.id.startsWith("poke-")) return `pokemon-${row.id.slice("poke-".length)}`
  return null
}

export function isVintagePokemonSetName(setName: string): boolean {
  return VINTAGE_SET_NAME_PATTERNS.some((pattern) => pattern.test(setName))
}

export function isModernTrendingPokemonSet(input: {
  setId: string
  setName: string
  releaseDate?: string | null
  now?: Date
}): boolean {
  if (isVintagePokemonSetName(input.setName)) return false
  if (isSlabItEligibleRelease(input.releaseDate, input.now)) return true

  const setId = input.setId.trim().toLowerCase()
  if (!setId) return false
  return MODERN_SET_ID_PREFIXES.some((prefix) => setId.startsWith(prefix))
}

export function recencyBoost(releaseDate: string | null | undefined, now = new Date()): number {
  if (!releaseDate?.trim()) return 0
  const parsed = Date.parse(releaseDate.trim())
  if (!Number.isFinite(parsed)) return 0
  const ageYears = (now.getTime() - parsed) / (365.25 * 24 * 60 * 60 * 1000)
  if (ageYears < 0 || ageYears > TCG_RESEARCH_TRENDING_SET_AGE_YEARS) return 0
  return Math.round((TCG_RESEARCH_TRENDING_SET_AGE_YEARS - ageYears) * 40)
}

export function scorePopularCard(input: {
  activityHits: number
  rawPrice: number
  psa10Price: number
  releaseDate?: string | null
}): number {
  const market = Math.max(input.rawPrice, input.psa10Price, 0)
  return input.activityHits * 10_000 + market + recencyBoost(input.releaseDate)
}

export function rankPopularHits(hits: ScoredHit[], limit: number): CardSearchHit[] {
  return hits
    .sort((a, b) => b.score - a.score || (b.hit.rawPrice ?? 0) - (a.hit.rawPrice ?? 0))
    .slice(0, limit)
    .map((entry) => entry.hit)
}

async function loadExpansionReleaseMap(): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("expansions")
    .select("id, release_date")
    .eq("game", "pokemon")

  if (error?.code === "42P01") return map
  if (error) throw error

  for (const row of data ?? []) {
    map.set(String(row.id), row.release_date ? String(row.release_date) : null)
  }
  return map
}

async function loadActivityByCatalog(catalogIds: string[]): Promise<Map<string, number>> {
  const activityByCatalog = new Map<string, number>()
  if (catalogIds.length === 0) return activityByCatalog

  const supabase = createAdminClient()
  const chunkSize = 200

  for (let i = 0; i < catalogIds.length; i += chunkSize) {
    const chunk = catalogIds.slice(i, i + chunkSize)
    const { data: activityRows } = await supabase
      .from("card_activity")
      .select("catalog_id, hit_count")
      .in("catalog_id", chunk)

    for (const row of activityRows ?? []) {
      const id = String(row.catalog_id)
      activityByCatalog.set(id, (activityByCatalog.get(id) ?? 0) + Number(row.hit_count ?? 0))
    }
  }

  return activityByCatalog
}

async function loadSlabItTrendingFallback(limit: number): Promise<CardSearchHit[]> {
  try {
    const cards = await getTopSlabItCards(Math.min(limit, TOP_CARDS_LIMIT))
    return cards.map((card) => ({
      id: card.watchlistId.startsWith("poke-") ? card.watchlistId : `poke-${card.id}`,
      pokemonTcgId: card.id,
      cardName: card.name,
      setName: card.set,
      cardNumber: card.cardNumber,
      imageUrl: upgradeCardImageUrlSync(card.image),
      rarity: null,
      rawPrice: card.rawPrice > 0 ? card.rawPrice : undefined,
    }))
  } catch {
    return []
  }
}

async function loadPokemonPopularFromCards(limit: number): Promise<CardSearchHit[]> {
  const supabase = createAdminClient()
  const releaseBySetId = await loadExpansionReleaseMap()
  const poolSize = Math.min(Math.max(limit * 8, 400), 2500)

  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, name, set_name, set_id, number, rarity, image_url, scrydex_id, current_price_raw, current_price_psa10, game",
    )
    .eq("game", "pokemon")
    .not("current_price_raw", "is", null)
    .gt("current_price_raw", 0)
    .order("current_price_raw", { ascending: false })
    .limit(poolSize)

  if (error?.code === "42703") {
    return loadSlabItTrendingFallback(limit)
  }
  if (error) throw error

  const modernRows = (data ?? []).filter((row) =>
    isModernTrendingPokemonSet({
      setId: String(row.set_id ?? ""),
      setName: String(row.set_name ?? ""),
      releaseDate: releaseBySetId.get(String(row.set_id)) ?? null,
    }),
  )

  const catalogIds = modernRows
    .map((row) => catalogIdFromPokemonRow(row as PokemonCardRow))
    .filter((id): id is string => Boolean(id))

  const activityByCatalog = await loadActivityByCatalog(catalogIds)

  const scored: ScoredHit[] = modernRows.map((row) => {
    const typed = row as PokemonCardRow
    const rawPrice = Number(typed.current_price_raw) || 0
    const psa10Price = Number(typed.current_price_psa10) || 0
    const catalogId = catalogIdFromPokemonRow(typed)
    const activityHits = catalogId ? activityByCatalog.get(catalogId) ?? 0 : 0
    const releaseDate = releaseBySetId.get(String(typed.set_id)) ?? null

    return {
      hit: cardsRowToSearchHit(typed),
      score: scorePopularCard({ activityHits, rawPrice, psa10Price, releaseDate }),
    }
  })

  const ranked = rankPopularHits(scored, limit)
  if (ranked.length >= Math.min(limit, 10)) return ranked

  const fallback = await loadSlabItTrendingFallback(limit)
  const byId = new Map<string, CardSearchHit>()
  for (const hit of [...ranked, ...fallback]) {
    if (!byId.has(hit.id)) byId.set(hit.id, hit)
  }
  return [...byId.values()].slice(0, limit)
}

async function loadCatalogPopular(game: TcgGame, limit: number): Promise<CardSearchHit[]> {
  const supabase = createAdminClient()
  const fetchLimit = Math.min(Math.max(limit * 4, limit), 400)

  const { data: activityRows, error: activityError } = await supabase
    .from("card_activity")
    .select("catalog_id, hit_count")
    .order("hit_count", { ascending: false })
    .limit(fetchLimit * 3)

  if (activityError?.code === "42P01") return []
  if (activityError) throw activityError

  const activityByCatalog = new Map<string, number>()
  for (const row of activityRows ?? []) {
    const id = String(row.catalog_id)
    activityByCatalog.set(id, (activityByCatalog.get(id) ?? 0) + Number(row.hit_count ?? 0))
  }

  const hotCatalogIds = [...activityByCatalog.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, fetchLimit * 2)
    .map(([catalogId]) => catalogId)

  const catalogQuery = supabase
    .from("catalog_cards")
    .select(
      "catalog_id, game, scrydex_id, name, set_name, set_code, number, rarity, image_small_url, image_large_url",
    )
    .eq("game", game)
    .limit(fetchLimit)

  const { data: catalogRows, error: catalogError } =
    hotCatalogIds.length > 0
      ? await supabase
          .from("catalog_cards")
          .select(
            "catalog_id, game, scrydex_id, name, set_name, set_code, number, rarity, image_small_url, image_large_url",
          )
          .eq("game", game)
          .in("catalog_id", hotCatalogIds)
      : await catalogQuery

  if (catalogError?.code === "42P01") return []
  if (catalogError) throw catalogError
  if (!catalogRows?.length) return []

  const releaseBySetCode =
    game === "pokemon" ? await loadExpansionReleaseMap() : new Map<string, string | null>()

  const catalogIds = catalogRows.map((row) => String(row.catalog_id))

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

    if (game === "pokemon") {
      const releaseDate = releaseBySetCode.get(String(row.set_code)) ?? null
      if (
        !isModernTrendingPokemonSet({
          setId: String(row.set_code ?? ""),
          setName: String(row.set_name ?? ""),
          releaseDate,
        })
      ) {
        continue
      }
    }

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
      score: scorePopularCard({
        activityHits,
        rawPrice,
        psa10Price,
        releaseDate: game === "pokemon" ? releaseBySetCode.get(String(row.set_code)) ?? null : null,
      }),
    })
  }

  return rankPopularHits(scored, limit)
}

/** Top popular cards for a TCG Research tab (modern sets, activity-weighted, price fallback). */
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
    if (fromCatalog.length >= Math.min(limit, 10)) return fromCatalog

    if (game === "pokemon") {
      return loadSlabItTrendingFallback(limit)
    }

    return []
  } catch (error) {
    console.warn("[tcg-research/popular] load failed:", game, error)
    if (game === "pokemon") {
      return loadSlabItTrendingFallback(limit)
    }
    return []
  }
}
