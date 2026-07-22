import { describe, expect, it } from "vitest"
import type { AiWeeklyPickCandidate } from "@/lib/ai-weekly-picks/types"
import { selectFallbackTierPicks, validateTierPicks } from "@/lib/ai-weekly-picks/fallback-tiers"
import { tierBudgetSpent } from "@/lib/ai-weekly-picks/tiers"

const sampleCandidates: AiWeeklyPickCandidate[] = [
  {
    scrydex_id: "base1-4",
    catalog_id: "pokemon-base1-4",
    card_name: "Charizard",
    set_name: "Base",
    image_url: null,
    raw_price: 420,
    psa10_price: 900,
    recommended_grade: "PSA_10",
    pick_price: 900,
    momentum_30d_pct: 12,
    supply_velocity: 8,
    spread_ratio: 2.1,
    composite_score: 0.82,
  },
  {
    scrydex_id: "swsh8-271",
    catalog_id: "pokemon-swsh8-271",
    card_name: "Gengar VMAX",
    set_name: "Fusion Strike",
    image_url: null,
    raw_price: 45,
    psa10_price: 95,
    recommended_grade: "RAW",
    pick_price: 45,
    momentum_30d_pct: 18,
    supply_velocity: 12,
    spread_ratio: 2.1,
    composite_score: 0.78,
  },
  {
    scrydex_id: "sv3-125",
    catalog_id: "pokemon-sv3-125",
    card_name: "Charizard ex",
    set_name: "Obsidian Flames",
    image_url: null,
    raw_price: 50,
    psa10_price: 80,
    recommended_grade: "RAW",
    pick_price: 50,
    momentum_30d_pct: 10,
    supply_velocity: 9,
    spread_ratio: 2.2,
    composite_score: 0.7,
  },
]

describe("fallback tier picks", () => {
  it("builds a tier 100 basket within budget range", () => {
    const picks = selectFallbackTierPicks(sampleCandidates, "100")
    const spent = tierBudgetSpent(picks.map((pick) => pick.pick_price))
    expect(spent).toBeGreaterThanOrEqual(85)
    expect(spent).toBeLessThanOrEqual(100)
    expect(validateTierPicks(picks, "100")).toBe(true)
  })
})
