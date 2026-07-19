import type { BuyoutAlert, BuyoutSale } from "@/lib/buyout-radar/types"

export type MarketSnapshotRow = {
  cardId: string
  scannedAt: string
  dailyVolume: number
  uniqueListings: number | null
  marketPrice: number
  listingsSource: "ebay-browse" | "comp-proxy" | "seed" | "unknown"
}

export const BASELINE_WINDOW = 14
export const VOLUME_Z_THRESHOLD = 3.0
export const LISTINGS_Z_THRESHOLD = -2.0
export const MAX_PRICE_PCT_CHANGE = 0.05
export const MAX_UNIQUE_LISTINGS_FOR_ALERT = 80
export const LISTING_SANITY_VOLUME_RATIO = 1.5

export type StealthSnapshotMetrics = {
  cardId: string
  scannedAt: string
  dailyVolume: number
  uniqueListings: number | null
  marketPrice: number
  listingsDelta: number
  volumeZScore: number | null
  listingsZScore: number | null
  pricePctChange2p: number | null
  stealthBuyoutAlert: boolean
  supplyFloorOk: boolean
  inventorySanityOk: boolean
}

function rollingZScores(values: number[], window = BASELINE_WINDOW): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < values.length; i += 1) {
    if (i < window) {
      out.push(null)
      continue
    }
    const prior = values.slice(i - window, i)
    const mean = prior.reduce((sum, n) => sum + n, 0) / prior.length
    const variance =
      prior.reduce((sum, n) => sum + (n - mean) ** 2, 0) / Math.max(prior.length, 1)
    const std = Math.sqrt(variance)
    if (std <= 0) {
      out.push(null)
      continue
    }
    out.push((values[i]! - mean) / std)
  }
  return out
}

function inventoryExplainedBySales(listingDelta: number, dailyVolume: number): boolean {
  if (listingDelta >= 0) return true
  return Math.abs(listingDelta) <= Math.max(dailyVolume, 1) * LISTING_SANITY_VOLUME_RATIO
}

function pctChange2Periods(prices: number[], index: number): number | null {
  if (index < 2) return null
  const prev = prices[index - 2]!
  if (prev <= 0) return null
  return (prices[index]! - prev) / prev
}

function priorityForStealth(volumeZ: number, listingsZ: number | null): "critical" | "high" | "warning" {
  if (volumeZ >= 5 || (listingsZ != null && listingsZ <= -3)) return "critical"
  if (volumeZ >= 4 || (listingsZ != null && listingsZ <= -2.5)) return "high"
  return "warning"
}

/**
 * Flag stealth market sweeps: volume spike + listing contraction while price is flat.
 * Requires at least BASELINE_WINDOW prior snapshots per card for Z-scores.
 */
export function detectStealthBuyouts(
  snapshots: MarketSnapshotRow[],
  cardsById: Map<
    string,
    { name: string; setName: string; releaseDate: string | null; imageUrl: string | null }
  >,
  now = new Date(),
): BuyoutAlert[] {
  const grouped = new Map<string, MarketSnapshotRow[]>()
  for (const row of snapshots) {
    const list = grouped.get(row.cardId) ?? []
    list.push(row)
    grouped.set(row.cardId, list)
  }

  const alerts: BuyoutAlert[] = []

  for (const [cardId, rows] of grouped) {
    const sorted = [...rows].sort(
      (a, b) => Date.parse(a.scannedAt) - Date.parse(b.scannedAt),
    )
    if (sorted.length < BASELINE_WINDOW + 1) continue

    const volumes = sorted.map((r) => r.dailyVolume)
    const listings = sorted.map((r) => r.uniqueListings ?? 0)
    const listingDeltas = listings.map((value, index) =>
      index === 0 ? 0 : value - listings[index - 1]!,
    )
    const prices = sorted.map((r) => r.marketPrice)

    const volumeZ = rollingZScores(volumes)
    const listingsZ = rollingZScores(listingDeltas)
    const latestIndex = sorted.length - 1
    const latest = sorted[latestIndex]!
    const latestVolumeZ = volumeZ[latestIndex]
    const latestListingsZ = listingsZ[latestIndex]
    const pricePct2p = pctChange2Periods(prices, latestIndex)

    if (latestVolumeZ == null || latest.uniqueListings == null) continue
    if (latestListingsZ == null) continue
    if (pricePct2p == null) continue

    const supplyFloorOk = latest.uniqueListings <= MAX_UNIQUE_LISTINGS_FOR_ALERT
    const volumeSpike = latestVolumeZ >= VOLUME_Z_THRESHOLD
    const listingContraction = latestListingsZ <= LISTINGS_Z_THRESHOLD
    const priceFlat = Math.abs(pricePct2p) <= MAX_PRICE_PCT_CHANGE
    const inventorySanityOk = inventoryExplainedBySales(
      listingDeltas[latestIndex]!,
      latest.dailyVolume,
    )

    if (!(supplyFloorOk && volumeSpike && listingContraction && priceFlat && inventorySanityOk)) {
      continue
    }

    const card = cardsById.get(cardId)
    const priority = priorityForStealth(latestVolumeZ, latestListingsZ)
    const buyoutProbabilityPercentage = Math.min(
      99,
      Math.round(
        (Math.min(latestVolumeZ / 6, 1) * 45 +
          Math.min(Math.abs(latestListingsZ) / 4, 1) * 35 +
          (priceFlat ? 20 : 0)) *
          100,
      ) / 100,
    )

    alerts.push({
      cardId,
      cardName: card?.name ?? cardId,
      setName: card?.setName ?? "Unknown",
      releaseDate: card?.releaseDate ?? null,
      imageUrl: card?.imageUrl ?? null,
      currentVolume: latest.dailyVolume,
      baselineVolume: 0,
      volumeMultiple: 0,
      uniqueBuyers: 0,
      buyerConcentrationIndex: 0,
      buyoutProbabilityPercentage,
      avgPrice24h: latest.marketPrice,
      avgPriceBaseline: prices[latestIndex - 2] ?? latest.marketPrice,
      priceDeltaPct: Math.round(pricePct2p * 1000) / 10,
      priority,
      recommendedAction:
        priority === "critical"
          ? "Speculative Buy"
          : priority === "high"
            ? "Accumulate Quietly"
            : "Monitor / Alert",
      hourlyVolume: [],
      notes: `Stealth sweep: volume Z=${latestVolumeZ.toFixed(2)}, listings Z=${latestListingsZ.toFixed(2)}, price still ${(pricePct2p * 100).toFixed(1)}% vs 2 periods ago. ${latest.uniqueListings} listings remain (≤${MAX_UNIQUE_LISTINGS_FOR_ALERT} supply floor).`,
      detectedAt: now.toISOString(),
      alertKind: "stealth",
      volumeZScore: Math.round(latestVolumeZ * 10000) / 10000,
      listingsZScore: Math.round(latestListingsZ * 10000) / 10000,
      uniqueListings: latest.uniqueListings,
      pricePctChange2p: Math.round(pricePct2p * 10000) / 10000,
    })
  }

  return alerts.sort(
    (a, b) => (b.volumeZScore ?? 0) - (a.volumeZScore ?? 0),
  )
}

/** Build a daily snapshot from sold comps pulled during a scan. */
export function snapshotFromSales(
  cardId: string,
  sales: BuyoutSale[],
  uniqueListings: number | null,
  listingsSource: MarketSnapshotRow["listingsSource"],
  now = new Date(),
): MarketSnapshotRow {
  const nowMs = now.getTime()
  const dayStart = nowMs - 24 * 60 * 60 * 1000
  const recent = sales.filter((sale) => {
    const t = Date.parse(sale.purchasedAt)
    return Number.isFinite(t) && t >= dayStart && t <= nowMs
  })
  const lastFive = [...sales]
    .sort((a, b) => Date.parse(b.purchasedAt) - Date.parse(a.purchasedAt))
    .slice(0, 5)
  const marketPrice =
    lastFive.length > 0
      ? Math.round(
          (lastFive.reduce((sum, s) => sum + s.totalPrice / Math.max(s.quantityPurchased, 1), 0) /
            lastFive.length) *
            100,
        ) / 100
      : 0

  return {
    cardId,
    scannedAt: now.toISOString(),
    dailyVolume: recent.reduce((sum, s) => sum + s.quantityPurchased, 0),
    uniqueListings,
    marketPrice,
    listingsSource,
  }
}
