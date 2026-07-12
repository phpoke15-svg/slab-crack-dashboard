import { describe, expect, it } from "vitest"
import { detectBuyoutRisks } from "@/lib/buyout-radar/detect"
import { buildSeedBuyoutSales, SEED_BUYOUT_CARDS } from "@/lib/buyout-radar/seed"

describe("detectBuyoutRisks", () => {
  it("flags seeded buyout cards with volume and concentration metrics", () => {
    const alerts = detectBuyoutRisks(SEED_BUYOUT_CARDS, buildSeedBuyoutSales())
    expect(alerts.length).toBeGreaterThanOrEqual(2)

    const umbreon = alerts.find((a) => a.cardId === "sv8-161")
    expect(umbreon).toBeTruthy()
    expect(umbreon!.volumeMultiple).toBeGreaterThanOrEqual(5)
    expect(umbreon!.uniqueBuyers).toBeLessThanOrEqual(2)
    expect(umbreon!.buyoutProbabilityPercentage).toBeGreaterThan(50)
    expect(umbreon!.hourlyVolume).toHaveLength(24)
    expect(["critical", "high", "warning"]).toContain(umbreon!.priority)
  })

  it("does not flag quiet cards like Miraidon", () => {
    const alerts = detectBuyoutRisks(SEED_BUYOUT_CARDS, buildSeedBuyoutSales())
    expect(alerts.some((a) => a.cardId === "sv2-215")).toBe(false)
  })
})
