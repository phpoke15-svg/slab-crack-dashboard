export type BuyoutPriority = "critical" | "high" | "warning"

export type RecommendedAction =
  | "Speculative Buy"
  | "Accumulate Quietly"
  | "Monitor / Alert"
  | "Sell Peak"

export type BuyoutCard = {
  id: string
  name: string
  setName: string
  releaseDate: string | null
  imageUrl: string | null
}

export type BuyoutSale = {
  id: string
  cardId: string
  quantityPurchased: number
  totalPrice: number
  buyerIpHash: string
  purchasedAt: string
}

export type BuyoutAlert = {
  cardId: string
  cardName: string
  setName: string
  releaseDate: string | null
  imageUrl: string | null
  currentVolume: number
  baselineVolume: number
  volumeMultiple: number
  uniqueBuyers: number
  buyerConcentrationIndex: number
  buyoutProbabilityPercentage: number
  /** Average $ paid per copy in the last 24h (from transactions). */
  avgPrice24h: number
  /** Average $ paid per copy over the prior baseline window. */
  avgPriceBaseline: number
  /** % change: 24h avg vs baseline avg (positive = paying up). */
  priceDeltaPct: number
  priority: BuyoutPriority
  recommendedAction: RecommendedAction
  /** Hourly quantity series for the last 24 hours (oldest → newest). */
  hourlyVolume: number[]
  notes: string
  detectedAt: string
  /** Volume-spike detector vs stealth Z-score inventory sweep. */
  alertKind?: "volume" | "stealth" | "both"
  volumeZScore?: number | null
  listingsZScore?: number | null
  uniqueListings?: number | null
  pricePctChange2p?: number | null
}

export type BuyoutRadarResponse = {
  ok: true
  source: "database" | "seed" | "market-scan"
  asOf: string
  alertCount: number
  alerts: BuyoutAlert[]
  scan?: {
    /** Cards with ingested sold comps so far (buyout_cards rows). */
    cardsScanned: number
    salesIngested: number
    lastScanAt: string | null
    mode: "demo" | "live"
    /** Full catalog size last recorded by the scanner. */
    marketUniverseSize?: number
    /** Next offset into the catalog for the following batch. */
    cursorOffset?: number
    /** Cards scraped per cron/manual batch. */
    batchSize?: number
  }
}
