import type {
  BuyoutAlert,
  BuyoutCard,
  BuyoutPriority,
  BuyoutSale,
  RecommendedAction,
} from "@/lib/buyout-radar/types"

const DEFAULT_WINDOW_HOURS = 24
const DEFAULT_BASELINE_DAYS = 14
/** Flag cards when 24h volume clears this multiple of the prior daily baseline. */
const VOLUME_MULTIPLE_THRESHOLD = 1.75
const MAX_UNIQUE_BUYERS = 2
/** Cold-start (no baseline): need at least this many 24h sales to flag. */
const COLD_START_MIN_VOLUME = 3

function recommendAction(
  probability: number,
  volumeMultiple: number,
  concentration: number,
): RecommendedAction {
  if (probability >= 85) return "Speculative Buy"
  if (volumeMultiple >= 8 && concentration >= 0.85) return "Speculative Buy"
  if (probability >= 70) return "Accumulate Quietly"
  return "Monitor / Alert"
}

/**
 * Priority bands — driven mainly by how extreme the volume spike is.
 * Probability is still shown as a confidence score on each alert.
 */
function priorityFor(
  probability: number,
  volumeMultiple: number,
): BuyoutPriority {
  if (volumeMultiple >= 8 && probability >= 75) return "critical"
  if (volumeMultiple >= 5 || probability >= 72) return "high"
  return "warning"
}

function averageUnitPrice(sales: BuyoutSale[]): number {
  let spend = 0
  let qty = 0
  for (const sale of sales) {
    if (sale.quantityPurchased <= 0 || sale.totalPrice < 0) continue
    spend += sale.totalPrice
    qty += sale.quantityPurchased
  }
  if (qty <= 0) return 0
  return Math.round((spend / qty) * 100) / 100
}

function hourlyVolumeSeries(
  sales: BuyoutSale[],
  cardId: string,
  nowMs: number,
  hours = 24,
): number[] {
  const buckets = Array.from({ length: hours }, () => 0)
  const start = nowMs - hours * 60 * 60 * 1000
  for (const sale of sales) {
    if (sale.cardId !== cardId) continue
    const t = Date.parse(sale.purchasedAt)
    if (!Number.isFinite(t) || t < start || t > nowMs) continue
    const idx = Math.min(hours - 1, Math.floor((t - start) / (60 * 60 * 1000)))
    buckets[idx] += sale.quantityPurchased
  }
  return buckets
}

/**
 * TypeScript mirror of `public.detect_buyout_risks()` for seed / offline mode.
 * Flags cards when 24h volume > 1.75× 14-day daily average (and unique buyers ≤ 2
 * when buyer hashes are available).
 */
export function detectBuyoutRisks(
  cards: BuyoutCard[],
  sales: BuyoutSale[],
  opts?: {
    now?: Date
    windowHours?: number
    baselineDays?: number
    volumeMultipleThreshold?: number
    maxUniqueBuyers?: number
    /**
     * Market sold-comps lack real buyer IDs. When true, classify from volume
     * (and price) spikes only — still compute concentration for display.
     */
    marketVolumeOnly?: boolean
  },
): BuyoutAlert[] {
  const now = opts?.now ?? new Date()
  const nowMs = now.getTime()
  const windowHours = opts?.windowHours ?? DEFAULT_WINDOW_HOURS
  const baselineDays = opts?.baselineDays ?? DEFAULT_BASELINE_DAYS
  const volumeThreshold = opts?.volumeMultipleThreshold ?? VOLUME_MULTIPLE_THRESHOLD
  const maxBuyers = opts?.maxUniqueBuyers ?? MAX_UNIQUE_BUYERS
  const marketVolumeOnly = opts?.marketVolumeOnly === true

  const windowStart = nowMs - windowHours * 60 * 60 * 1000
  const baselineStart = nowMs - baselineDays * 24 * 60 * 60 * 1000
  const baselineDaysEffective = Math.max(baselineDays - windowHours / 24, 1)

  const alerts: BuyoutAlert[] = []

  for (const card of cards) {
    const cardSales = sales.filter((s) => s.cardId === card.id)
    const windowSales = cardSales.filter((s) => {
      const t = Date.parse(s.purchasedAt)
      return Number.isFinite(t) && t >= windowStart && t <= nowMs
    })
    const baselineSales = cardSales.filter((s) => {
      const t = Date.parse(s.purchasedAt)
      return Number.isFinite(t) && t >= baselineStart && t < windowStart
    })

    const currentVolume = windowSales.reduce((sum, s) => sum + s.quantityPurchased, 0)
    if (currentVolume <= 0) continue

    const uniqueBuyers = new Set(windowSales.map((s) => s.buyerIpHash)).size
    const baselineQty = baselineSales.reduce((sum, s) => sum + s.quantityPurchased, 0)
    const baselineVolume = baselineQty / baselineDaysEffective

    let volumeMultiple = 0
    if (baselineVolume <= 0) {
      volumeMultiple = currentVolume >= COLD_START_MIN_VOLUME ? 99 : 0
    } else {
      volumeMultiple = currentVolume / baselineVolume
    }

    if (volumeMultiple < volumeThreshold) continue
    if (!marketVolumeOnly) {
      if (uniqueBuyers <= 0 || uniqueBuyers > maxBuyers) continue
    }

    const buyerConcentrationIndex =
      currentVolume <= 0 ? 0 : Math.max(0, Math.min(1, 1 - uniqueBuyers / currentVolume))

    const buyoutProbabilityPercentage = Math.min(
      99.9,
      Math.max(
        0,
        Math.round(
          (Math.min(volumeMultiple / 10, 1) * 55 +
            buyerConcentrationIndex * (marketVolumeOnly ? 15 : 30) +
            (marketVolumeOnly
              ? Math.min(currentVolume, 20)
              : uniqueBuyers <= maxBuyers
                ? 15
                : uniqueBuyers <= 4
                  ? 8
                  : 0)) *
            100,
        ) / 100,
      ),
    )

    const priority = priorityFor(buyoutProbabilityPercentage, volumeMultiple)
    const recommendedAction = recommendAction(
      buyoutProbabilityPercentage,
      volumeMultiple,
      buyerConcentrationIndex,
    )

    const avgPrice24h = averageUnitPrice(windowSales)
    const avgPriceBaseline = averageUnitPrice(baselineSales)
    const priceDeltaPct =
      avgPriceBaseline > 0
        ? Math.round(((avgPrice24h - avgPriceBaseline) / avgPriceBaseline) * 1000) / 10
        : 0

    alerts.push({
      cardId: card.id,
      cardName: card.name,
      setName: card.setName,
      releaseDate: card.releaseDate,
      imageUrl: card.imageUrl,
      currentVolume,
      baselineVolume: Math.round(baselineVolume * 10000) / 10000,
      volumeMultiple: Math.round(volumeMultiple * 10000) / 10000,
      uniqueBuyers,
      buyerConcentrationIndex: Math.round(buyerConcentrationIndex * 10000) / 10000,
      buyoutProbabilityPercentage,
      avgPrice24h,
      avgPriceBaseline,
      priceDeltaPct,
      priority,
      recommendedAction,
      hourlyVolume: hourlyVolumeSeries(sales, card.id, nowMs),
      notes: marketVolumeOnly
        ? `Market scan: ${currentVolume} raw sales in 24h vs ~${baselineVolume.toFixed(1)}/day baseline (${volumeMultiple.toFixed(1)}×). Avg paid $${avgPrice24h.toFixed(2)} (was $${avgPriceBaseline.toFixed(2)}). Buyer IDs unavailable from public sold comps — ranked by volume spike.`
        : `Live window volume ${currentVolume} vs baseline daily avg ${baselineVolume.toFixed(2)} (${volumeMultiple.toFixed(1)}×). ${uniqueBuyers} unique buyer hash(es). Avg paid $${avgPrice24h.toFixed(2)} (was $${avgPriceBaseline.toFixed(2)}).`,
      detectedAt: now.toISOString(),
    })
  }

  return alerts.sort(
    (a, b) =>
      b.buyoutProbabilityPercentage - a.buyoutProbabilityPercentage ||
      b.volumeMultiple - a.volumeMultiple,
  )
}
