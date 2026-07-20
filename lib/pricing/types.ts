export type PriceSource = "pricecharting" | "tcggo" | "ebay" | "binder_migrate" | "merged"

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
}

export type CardPriceTarget = {
  cardId: string
  cardName: string
  setName: string
  cardNumber?: string
  priceChartingId?: string
  /** TCGGO / RapidAPI internal card id (cached after first lookup). */
  tcgGoId?: number
  /** TCGplayer product id for cards not yet indexed by tcgid. */
  tcgplayerId?: number
}

export type FetchedCardPrices = {
  rawPrice: number
  psa7Price: number
  psa8Price: number
  psa9Price: number
  psa10Price: number
  priceSource: PriceSource
}

export type PriceHistoryPoint = {
  cardId: string
  snapshotDate: string
  grade: number
  price: number
  saleCount?: number
  source: string
}

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
  source: "pricecharting" | "tcggo" | "skipped"
}
