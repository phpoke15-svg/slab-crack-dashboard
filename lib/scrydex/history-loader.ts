import { flattenHistoryPoints } from "@/lib/scrydex/adapters"
import { ScrydexClient } from "@/lib/scrydex/client"
import { createCatalogService } from "@/lib/scrydex/catalog-service"
import { isScrydexConfigured, toCatalogId } from "@/lib/scrydex/constants"
import { getCatalogCard, loadDailyHistoryRows, persistHistoryPointsBatch } from "@/lib/scrydex/db"
import { ScrydexApiError } from "@/lib/scrydex/errors"
import {
  filterRechartsRowsByType,
  pivotHistoryRowsForChart,
  toRechartsHistoryRows,
  type RechartsHistoryRow,
} from "@/lib/scrydex/history-chart"
import {
  parsePriceHistoryType,
  resolvePriceHistoryDateRange,
  type PriceHistoryType,
} from "@/lib/scrydex/price-history-type"
import type { TcgGame } from "@/lib/scrydex/types"

const MIN_LOCAL_DAYS = 2

function distinctSnapshotDates(rows: Array<Record<string, unknown>>): Set<string> {
  return new Set(
    rows
      .map((row) => String(row.snapshot_date ?? "").slice(0, 10))
      .filter(Boolean),
  )
}

function isLocalHistoryIncomplete(
  rows: Array<Record<string, unknown>>,
  range: { from: string; to: string },
): boolean {
  const dates = distinctSnapshotDates(rows)
  if (dates.size < MIN_LOCAL_DAYS) return true

  const recentCutoff = new Date(range.to)
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - 3)
  const recentFrom = recentCutoff.toISOString().slice(0, 10)
  const weekAgo = new Date()
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7)
  const weekAgoDate = weekAgo.toISOString().slice(0, 10)

  if (range.to >= weekAgoDate) {
    const hasRecent = [...dates].some((date) => date >= recentFrom && date <= range.to)
    if (!hasRecent) return true
  }

  return false
}

async function resolveCatalogCard(catalogId: string) {
  let card = await getCatalogCard(catalogId)
  if (card) return card

  if (!isScrydexConfigured()) return null

  try {
    await createCatalogService().ensureFreshCard(catalogId)
  } catch (error) {
    console.warn("[scrydex/history-loader] ensureFreshCard failed:", catalogId, error)
  }

  return getCatalogCard(catalogId)
}

async function backfillFromScrydex(input: {
  catalogId: string
  game: TcgGame
  scrydexId: string
  from: string
  to: string
  interval: string
}): Promise<{ inserted: number; rateLimited: boolean; truncated: boolean }> {
  const client = ScrydexClient.fromEnv()
  let payload

  try {
    payload = await client.getAllPriceHistoryInRange(
      input.game,
      input.scrydexId,
      {
        from: input.from,
        to: input.to,
        interval: input.interval,
      },
      { catalogId: input.catalogId, game: input.game },
    )
  } catch (error) {
    if (error instanceof ScrydexApiError && error.status === 429) {
      console.warn("[scrydex/history-loader] Scrydex rate limited (429):", input.catalogId)
      return { inserted: 0, rateLimited: true, truncated: false }
    }
    throw error
  }

  const points = flattenHistoryPoints(input.catalogId, payload ?? [])
  if (points.length === 0) {
    return { inserted: 0, rateLimited: false, truncated: false }
  }

  const inserted = await persistHistoryPointsBatch(input.catalogId, points)
  return { inserted, rateLimited: false, truncated: false }
}

/** Load pivoted chart rows from `price_history_daily`, backfilling gaps via Scrydex when needed. */
export async function loadScrydexPriceHistoryChart(input: {
  scrydexId: string
  game?: TcgGame
  days?: number
  full?: boolean
  from?: string | null
  to?: string | null
  interval?: string
  type?: PriceHistoryType | string | null
  backfill?: boolean
}): Promise<{
  catalogId: string
  rows: RechartsHistoryRow[]
  source: "local" | "hybrid"
  backfilled: boolean
  rateLimited: boolean
}> {
  const game = input.game ?? "pokemon"
  const days = input.days ?? 90
  const type = parsePriceHistoryType(input.type)
  const interval = input.interval ?? "daily"
  const catalogId = toCatalogId(game, input.scrydexId)
  const range = resolvePriceHistoryDateRange({
    days,
    full: input.full ?? days <= 0,
    fromParam: input.from,
    toParam: input.to,
  })

  let dailyRows = await loadDailyHistoryRows(catalogId, days, range)
  let backfilled = false
  let rateLimited = false

  const shouldBackfill =
    input.backfill !== false &&
    isScrydexConfigured() &&
    isLocalHistoryIncomplete(dailyRows, range)

  if (shouldBackfill) {
    const card = await resolveCatalogCard(catalogId)
    if (card?.scrydex_id) {
      try {
        const result = await backfillFromScrydex({
          catalogId,
          game: card.game,
          scrydexId: card.scrydex_id,
          from: range.from,
          to: range.to,
          interval,
        })
        backfilled = result.inserted > 0
        rateLimited = result.rateLimited

        if (result.inserted > 0) {
          dailyRows = await loadDailyHistoryRows(catalogId, days, range)
        }
      } catch (error) {
        console.warn("[scrydex/history-loader] Scrydex backfill failed:", catalogId, error)
      }
    }
  }

  const pivoted = pivotHistoryRowsForChart(dailyRows)
  const rows = filterRechartsRowsByType(toRechartsHistoryRows(pivoted), type)

  return {
    catalogId,
    rows,
    source: backfilled ? "hybrid" : "local",
    backfilled,
    rateLimited,
  }
}
