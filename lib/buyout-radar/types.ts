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
  priority: BuyoutPriority
  recommendedAction: RecommendedAction
  /** Hourly quantity series for the last 24 hours (oldest → newest). */
  hourlyVolume: number[]
  notes: string
  detectedAt: string
}

export type BuyoutRadarResponse = {
  ok: true
  source: "database" | "seed"
  asOf: string
  alertCount: number
  alerts: BuyoutAlert[]
}
