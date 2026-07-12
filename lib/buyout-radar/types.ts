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
}

export type BuyoutRadarResponse = {
  ok: true
  source: "database" | "seed" | "market-scan"
  asOf: string
  alertCount: number
  alerts: BuyoutAlert[]
  scan?: {
    cardsScanned: number
    salesIngested: number
    lastScanAt: string | null
    mode: "demo" | "live"
  }
}
