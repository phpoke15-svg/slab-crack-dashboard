import { flattenHistoryPoints } from "@/lib/scrydex/adapters"
import { ScrydexClient } from "@/lib/scrydex/client"
import { createCatalogService } from "@/lib/scrydex/catalog-service"
import { isScrydexConfigured, resolveCatalogId } from "@/lib/scrydex/constants"
import {
  countDistinctDailyHistoryDays,
  getCatalogCard,
  loadDailyHistoryRows,
  persistHistoryPointsBatch,
} from "@/lib/scrydex/db"
import type { ScrydexPriceHistoryDuration } from "@/lib/scrydex/types"
import { scrydexHistoryRowsToSeriesMap } from "@/lib/tcg-research/scrydex-price-history"
import type { PriceHistorySeriesKey } from "@/lib/pricing/types"
import type { PriceHistorySeriesMap } from "@/lib/pricing/types"

const MIN_DISTINCT_DAYS = 2
const BACKFILL_DURATIONS: ScrydexPriceHistoryDuration[] = ["180d", "full"]

export type EnsureCardDailyPriceHistoryResult = {
  catalogId: string | null
  backfilled: boolean
  distinctDays: number
  pointsInserted: number
  reason: "cached" | "backfilled" | "skipped" | "no_catalog" | "no_scrydex"
}

async function resolveCatalogCard(catalogId: string) {
  let card = await getCatalogCard(catalogId)
  if (card) return card

  if (!isScrydexConfigured()) return null

  try {
    await createCatalogService().ensureFreshCard(catalogId)
  } catch (error) {
    console.warn("[card-daily-price-history] ensureFreshCard failed:", catalogId, error)
  }

  card = await getCatalogCard(catalogId)
  return card
}

async function fetchAndPersistDuration(
  catalogId: string,
  game: "pokemon" | "lorcana" | "mtg",
  scrydexId: string,
  duration: ScrydexPriceHistoryDuration,
): Promise<number> {
  const client = ScrydexClient.fromEnv()
  const payload = await client.getAllPriceHistory(
    game,
    scrydexId,
    { priceHistoryDuration: duration },
    { catalogId, game },
  )

  const points = flattenHistoryPoints(catalogId, payload)
  if (points.length === 0) return 0
  return persistHistoryPointsBatch(catalogId, points)
}

/**
 * Ensure Scrydex daily history exists in `price_history_daily` for a Slab Labs card id.
 * Backfills with priceHistoryDuration=180d, then full, when fewer than 2 distinct days are stored.
 */
export async function ensureCardDailyPriceHistory(cardId: string): Promise<EnsureCardDailyPriceHistoryResult> {
  const catalogId = resolveCatalogId(cardId)
  if (!catalogId) {
    return { catalogId: null, backfilled: false, distinctDays: 0, pointsInserted: 0, reason: "no_catalog" }
  }

  if (!isScrydexConfigured()) {
    return { catalogId, backfilled: false, distinctDays: 0, pointsInserted: 0, reason: "no_scrydex" }
  }

  let distinctDays = await countDistinctDailyHistoryDays(catalogId)
  if (distinctDays >= MIN_DISTINCT_DAYS) {
    return { catalogId, backfilled: false, distinctDays, pointsInserted: 0, reason: "cached" }
  }

  const card = await resolveCatalogCard(catalogId)
  if (!card?.scrydex_id) {
    return { catalogId, backfilled: false, distinctDays, pointsInserted: 0, reason: "no_catalog" }
  }

  let pointsInserted = 0
  for (const duration of BACKFILL_DURATIONS) {
    try {
      pointsInserted += await fetchAndPersistDuration(
        catalogId,
        card.game,
        card.scrydex_id,
        duration,
      )
    } catch (error) {
      console.warn("[card-daily-price-history] Scrydex backfill failed:", catalogId, duration, error)
    }

    distinctDays = await countDistinctDailyHistoryDays(catalogId)
    if (distinctDays >= MIN_DISTINCT_DAYS) break
  }

  return {
    catalogId,
    backfilled: pointsInserted > 0,
    distinctDays,
    pointsInserted,
    reason: pointsInserted > 0 ? "backfilled" : "skipped",
  }
}

export async function getCardDailyPriceHistorySeries(
  cardId: string,
  days: number,
): Promise<{
  catalogId: string | null
  series: PriceHistorySeriesMap
  range: { from: string | null; to: string | null }
}> {
  const catalogId = resolveCatalogId(cardId)
  if (!catalogId) {
    const empty = Object.fromEntries(
      (["raw", "psa7", "psa8", "psa9", "psa10"] as PriceHistorySeriesKey[]).map((key) => [key, []]),
    ) as PriceHistorySeriesMap
    return { catalogId: null, series: empty, range: { from: null, to: null } }
  }

  const rows = await loadDailyHistoryRows(catalogId, days)
  const mapped = scrydexHistoryRowsToSeriesMap(rows as never[], days)

  const series = Object.fromEntries(
    Object.entries(mapped.series).map(([key, points]) => [
      key,
      points.map((point) => ({
        date: point.date,
        price: point.price,
        source: "scrydex",
      })),
    ]),
  ) as PriceHistorySeriesMap

  return { catalogId, series, range: mapped.range }
}
