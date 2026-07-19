import type { MarketSnapshotRow } from "@/lib/buyout-radar/stealth-detect"

function daysAgoIso(days: number, now = Date.now()): string {
  const d = new Date(now - days * 24 * 60 * 60 * 1000)
  d.setUTCHours(12, 0, 0, 0)
  return d.toISOString()
}

/**
 * 15-day snapshot history so stealth Z-scores fire in demo mode.
 * Charizard ex shows a pre-spike sweep; other cards stay quiet.
 */
export function buildSeedMarketSnapshots(now = Date.now()): MarketSnapshotRow[] {
  const rows: MarketSnapshotRow[] = []

  for (let day = 14; day >= 0; day -= 1) {
    const scannedAt = daysAgoIso(day, now)

    rows.push({
      cardId: "sv3pt5-151",
      scannedAt,
      dailyVolume: 2 + (day % 3),
      uniqueListings: 46 - (day % 4),
      marketPrice: 18.5 + (14 - day) * 0.05,
      listingsSource: "seed",
    })

    let volume: number
    let listings: number
    let price: number
    if (day >= 2) {
      volume = 2 + (day % 2)
      listings = 58 - (day % 3)
      price = 118
    } else {
      volume = day === 0 ? 28 : 9
      listings = day === 0 ? 18 : 34
      price = day === 0 ? 118.5 : 118
    }

    rows.push({
      cardId: "sv3-223",
      scannedAt,
      dailyVolume: volume,
      uniqueListings: listings,
      marketPrice: price,
      listingsSource: "seed",
    })
  }

  return rows
}
