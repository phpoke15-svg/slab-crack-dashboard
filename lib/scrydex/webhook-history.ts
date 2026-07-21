import { persistHistoryPointsBatch } from "@/lib/scrydex/db"
import { toCatalogId } from "@/lib/scrydex/constants"
import type { TcgGame } from "@/lib/scrydex/types"

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function positivePrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Number(value)
}

/** Build price_history_daily rows from webhook snapshot prices. */
export function webhookPricesToDailyHistoryRows(input: {
  catalogId: string
  snapshotDate?: string
  raw?: number | null
  psa10?: number | null
  capturedAt?: string
}): Array<Record<string, unknown>> {
  const snapshotDate = input.snapshotDate ?? todayUtcDate()
  const capturedAt = input.capturedAt ?? new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []

  const raw = positivePrice(input.raw)
  if (raw != null) {
    rows.push({
      catalog_id: input.catalogId,
      snapshot_date: snapshotDate,
      price_type: "raw",
      variant: "normal",
      condition: "NM",
      company: null,
      grade: null,
      market_price: raw,
      low_price: null,
      currency: "USD",
      source: "scrydex",
      captured_at: capturedAt,
    })
  }

  const psa10 = positivePrice(input.psa10)
  if (psa10 != null) {
    rows.push({
      catalog_id: input.catalogId,
      snapshot_date: snapshotDate,
      price_type: "graded",
      variant: "normal",
      condition: null,
      company: "PSA",
      grade: "10",
      market_price: psa10,
      low_price: null,
      currency: "USD",
      source: "scrydex",
      captured_at: capturedAt,
    })
  }

  return rows
}

export function resolveWebhookCatalogId(scrydexId: string, game: TcgGame = "pokemon"): string {
  return toCatalogId(game, scrydexId)
}

export async function upsertWebhookDailyHistory(input: {
  scrydexId: string
  game?: TcgGame
  raw?: number | null
  psa10?: number | null
  snapshotDate?: string
}): Promise<number> {
  const catalogId = resolveWebhookCatalogId(input.scrydexId, input.game ?? "pokemon")
  const rows = webhookPricesToDailyHistoryRows({
    catalogId,
    snapshotDate: input.snapshotDate,
    raw: input.raw,
    psa10: input.psa10,
  })
  if (rows.length === 0) return 0
  return persistHistoryPointsBatch(catalogId, rows)
}
