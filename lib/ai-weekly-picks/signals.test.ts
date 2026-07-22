import { describe, expect, it } from "vitest"
import {
  computeMomentum30dPct,
  computeSpreadRatio,
  computeSupplyVelocity,
  recommendGradeType,
} from "@/lib/ai-weekly-picks/signals"
import { weekStartDateUtc } from "@/lib/ai-weekly-picks/week"

describe("ai-weekly-picks signals", () => {
  it("computes 30-day momentum from daily history rows", () => {
    const rows = [
      { snapshot_date: "2026-06-01", price_type: "raw", variant: "normal", condition: "NM", market_price: 10 },
      { snapshot_date: "2026-07-01", price_type: "raw", variant: "normal", condition: "NM", market_price: 12 },
    ]
    expect(computeMomentum30dPct(rows, "RAW")).toBeCloseTo(20, 1)
  })

  it("counts supply velocity as distinct recent snapshot days", () => {
    const rows = [
      { snapshot_date: "2026-07-01", market_price: 1 },
      { snapshot_date: "2026-07-02", market_price: 2 },
      { snapshot_date: "2026-07-03", market_price: 3 },
    ]
    expect(computeSupplyVelocity(rows)).toBe(3)
  })

  it("computes PSA 10 spread ratio", () => {
    expect(computeSpreadRatio(100, 180)).toBe(1.8)
  })

  it("recommends PSA 10 when spread and momentum favor grading", () => {
    expect(recommendGradeType(100, 180, 5, 15, 1.8)).toBe("PSA_10")
    expect(recommendGradeType(100, 120, 18, 8, 1.2)).toBe("RAW")
  })
})

describe("weekStartDateUtc", () => {
  it("returns Monday for a mid-week date", () => {
    expect(weekStartDateUtc(new Date("2026-07-22T12:00:00Z"))).toBe("2026-07-20")
  })
})
