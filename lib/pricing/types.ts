import type { CardLanguage } from "@/lib/types/pokemon-api"

/** Primary live source is pokemon-api.com (stored as tcggo). Legacy pricecharting is deprecated. */
export type PriceSource = "tcggo" | "pricecharting" | "ebay" | "binder_migrate" | "merged"

export type CardPriceRow = {
  card_id: string
  raw_price: number | null
  psa7_price: number | null
  psa8_price: number | null
  psa9_price: number | null
  psa10_price: number | null
  price_source: PriceSource | string
  synced_at: string
  sync_error: string | null
  card_name: string | null
  card_set: string | null
  card_number: string | null
  /** pokemon-api.com internal card id */
  tcggo_id?: number | null
  tcgplayer_id?: number | null
  /** Bare tcg id, e.g. sv3pt5-173 */
  tcg_id?: string | null
  language?: CardLanguage | null
  /** Original PriceCharting product id before re-key migration */
  legacy_pricecharting_id?: string | null
}

export type CardPriceTarget = {
  cardId: string
  cardName: string
  setName: string
  cardNumber?: string
  /** @deprecated Use legacyPriceChartingId — removed in Phase 5 */
  priceChartingId?: string
  legacyPriceChartingId?: string
  /** pokemon-api.com internal card id (cached after first lookup). */
  tcgGoId?: number
  /** TCGplayer product id for cards not yet indexed by tcgid. */
  tcgplayerId?: number
  language?: CardLanguage
}

export type FetchedCardPrices = {
  rawPrice: number
  psa7Price: number
  psa8Price: number
  psa9Price: number
  psa10Price: number
  priceSource: PriceSource
  tcgGoId?: number
  tcgplayerId?: number
  tcgId?: string
  language?: CardLanguage
}

export type PriceHistoryPoint = {
  cardId: string
  snapshotDate: string
  grade: number
  price: number
  saleCount?: number
  source: string
}

export type PriceHistorySeriesKey = "raw" | "psa7" | "psa8" | "psa9" | "psa10"

export type PriceHistorySeriesPoint = {
  date: string
  price: number
  saleCount?: number
  source?: string
}

export type PriceHistorySeriesMap = Record<PriceHistorySeriesKey, PriceHistorySeriesPoint[]>

export type SyncCardPricesResult = {
  syncedAt: string
  candidates: number
  refreshed: number
  skipped: number
  failed: number
  processed: number
  remaining: number
  stoppedEarly: boolean
  errors: string[]
  source: "tcggo" | "pricecharting" | "skipped"
}

export type LegacyIdResolutionStatus = "pending" | "resolved" | "failed" | "skipped" | "manual"

export type CardIdLegacyMapRow = {
  legacy_pc_id: string
  new_poke_id: string | null
  tcggo_id: number | null
  tcgplayer_id: number | null
  tcg_id: string | null
  card_name: string | null
  card_set: string | null
  card_number: string | null
  language: CardLanguage | null
  resolution_status: LegacyIdResolutionStatus
  resolution_error: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}
