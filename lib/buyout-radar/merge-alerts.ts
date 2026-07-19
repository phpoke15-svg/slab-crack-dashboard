import type { BuyoutAlert, BuyoutPriority } from "@/lib/buyout-radar/types"

const PRIORITY_RANK: Record<BuyoutPriority, number> = {
  critical: 3,
  high: 2,
  warning: 1,
}

function higherPriority(a: BuyoutPriority, b: BuyoutPriority): BuyoutPriority {
  return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b
}

/** Combine volume-spike and stealth Z-score alerts per card. */
export function mergeBuyoutAlerts(
  volumeAlerts: BuyoutAlert[],
  stealthAlerts: BuyoutAlert[],
): BuyoutAlert[] {
  const map = new Map<string, BuyoutAlert>()

  for (const alert of volumeAlerts) {
    map.set(alert.cardId, { ...alert, alertKind: alert.alertKind ?? "volume" })
  }

  for (const stealth of stealthAlerts) {
    const existing = map.get(stealth.cardId)
    if (!existing) {
      map.set(stealth.cardId, stealth)
      continue
    }
    map.set(stealth.cardId, {
      ...existing,
      alertKind: "both",
      priority: higherPriority(existing.priority, stealth.priority),
      buyoutProbabilityPercentage: Math.max(
        existing.buyoutProbabilityPercentage,
        stealth.buyoutProbabilityPercentage,
      ),
      volumeZScore: stealth.volumeZScore,
      listingsZScore: stealth.listingsZScore,
      uniqueListings: stealth.uniqueListings,
      pricePctChange2p: stealth.pricePctChange2p,
      notes: `${existing.notes} | ${stealth.notes}`,
    })
  }

  return [...map.values()].sort(
    (a, b) =>
      b.buyoutProbabilityPercentage - a.buyoutProbabilityPercentage ||
      (b.volumeZScore ?? 0) - (a.volumeZScore ?? 0),
  )
}
