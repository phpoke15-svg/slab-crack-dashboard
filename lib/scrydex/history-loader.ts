import { ensureCardDailyPriceHistory } from "@/lib/pricing/card-daily-price-history"
import { isScrydexConfigured, toCatalogId } from "@/lib/scrydex/constants"
import { loadDailyHistoryRows } from "@/lib/scrydex/db"
import {
  pivotHistoryRowsForChart,
  toRechartsHistoryRows,
  type RechartsHistoryRow,
} from "@/lib/scrydex/history-chart"
import type { TcgGame } from "@/lib/scrydex/types"

/** Load pivoted chart rows from Scrydex daily history (`price_history_daily`). */
export async function loadScrydexPriceHistoryChart(input: {
  scrydexId: string
  game?: TcgGame
  days?: number
  backfill?: boolean
}): Promise<{
  catalogId: string
  rows: RechartsHistoryRow[]
}> {
  const game = input.game ?? "pokemon"
  const days = input.days ?? 90
  const catalogId = toCatalogId(game, input.scrydexId)
  const legacyCardId = game === "pokemon" ? `poke-${input.scrydexId}` : catalogId

  if (input.backfill !== false && isScrydexConfigured()) {
    await ensureCardDailyPriceHistory(legacyCardId).catch((error) => {
      console.warn("[scrydex/history-loader] backfill failed:", catalogId, error)
    })
  }

  const dailyRows = await loadDailyHistoryRows(catalogId, days)
  const pivoted = pivotHistoryRowsForChart(dailyRows)
  return {
    catalogId,
    rows: toRechartsHistoryRows(pivoted),
  }
}
