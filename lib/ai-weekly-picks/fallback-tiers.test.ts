import { describe, expect, it } from "vitest"
import type { AiWeeklyPickCandidate } from "@/lib/ai-weekly-picks/types"
import {
  selectFallbackMultiTierPicks,
  selectFallbackTierPicks,
  validateTierPicks,
} from "@/lib/ai-weekly-picks/fallback-tiers"
import { cardHasPickablePrice, tierBudgetSpent } from "@/lib/ai-weekly-picks/tiers"

function mockCandidate(
  scrydexId: string,
  raw: number,
  psa10: number,
  score: number,
): AiWeeklyPickCandidate {
  return {
    scrydex_id: scrydexId,
    catalog_id: `pokemon-${scrydexId}`,
    card_name: scrydexId,
    set_name: "Test Set",
    image_url: null,
    raw_price: raw,
    psa10_price: psa10,
    recommended_grade: raw <= psa10 ? "RAW" : "PSA_10",
    pick_price: raw <= psa10 ? raw : psa10,
    momentum_30d_pct: 12,
    supply_velocity: 8,
    spread_ratio: psa10 / Math.max(raw, 1),
    composite_score: score,
  }
}

const sampleCandidates: AiWeeklyPickCandidate[] = [
  mockCandidate("base1-4", 420, 900, 0.82),
  mockCandidate("swsh8-271", 45, 95, 0.78),
  mockCandidate("sv3-125", 50, 80, 0.7),
]

const broadCandidates: AiWeeklyPickCandidate[] = [
  mockCandidate("c1", 30, 70, 0.95),
  mockCandidate("c2", 35, 75, 0.92),
  mockCandidate("c3", 40, 85, 0.9),
  mockCandidate("c4", 55, 110, 0.88),
  mockCandidate("c5", 70, 140, 0.86),
  mockCandidate("c6", 95, 180, 0.84),
  mockCandidate("c7", 120, 220, 0.82),
  mockCandidate("c8", 150, 280, 0.8),
  mockCandidate("c9", 180, 320, 0.78),
  mockCandidate("c10", 210, 380, 0.76),
  mockCandidate("c11", 260, 450, 0.74),
  mockCandidate("c12", 320, 520, 0.72),
  mockCandidate("c13", 380, 620, 0.7),
  mockCandidate("c14", 450, 760, 0.68),
  mockCandidate("c15", 520, 900, 0.66),
  mockCandidate("c16", 600, 980, 0.64),
  mockCandidate("c17", 650, 1200, 0.62),
  mockCandidate("c18", 700, 1500, 0.6),
]

describe("candidate price window", () => {
  it("accepts cards when only raw or only PSA 10 is in range", () => {
    expect(cardHasPickablePrice(45, 1200)).toBe(true)
    expect(cardHasPickablePrice(12, 80)).toBe(true)
    expect(cardHasPickablePrice(12, 18)).toBe(false)
  })
})

describe("fallback tier picks", () => {
  it("builds a tier 100 basket within budget range", () => {
    const picks = selectFallbackTierPicks(sampleCandidates, "100")
    const spent = tierBudgetSpent(picks.map((pick) => pick.pick_price))
    expect(spent).toBeGreaterThanOrEqual(85)
    expect(spent).toBeLessThanOrEqual(100)
    expect(validateTierPicks(picks, "100")).toBe(true)
  })

  it("builds all four tier baskets from a broad candidate pool", () => {
    const picks = selectFallbackMultiTierPicks(broadCandidates)
    const tiers = new Set(picks.map((pick) => pick.bucket_tier))
    expect(tiers.has("100")).toBe(true)
    expect(tiers.has("250")).toBe(true)
    expect(tiers.has("500")).toBe(true)
    expect(tiers.has("1000")).toBe(true)
    for (const tier of ["100", "250", "500", "1000"] as const) {
      expect(validateTierPicks(picks, tier)).toBe(true)
    }
  })
})
