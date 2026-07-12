import { describe, expect, it } from "vitest"
import { detectBuyoutRisks } from "@/lib/buyout-radar/detect"
import { buildSeedBuyoutSales, SEED_BUYOUT_CARDS } from "@/lib/buyout-radar/seed"

describe("detectBuyoutRisks", () => {
  it("flags seeded buyout cards across critical / high / warning tiers", () => {
    const alerts = detectBuyoutRisks(SEED_BUYOUT_CARDS, buildSeedBuyoutSales())
    expect(alerts.length).toBeGreaterThanOrEqual(3)

    const critical = alerts.filter((a) => a.priority === "critical")
    const high = alerts.filter((a) => a.priority === "high")
    const warning = alerts.filter((a) => a.priority === "warning")

    expect(critical.length).toBeGreaterThanOrEqual(1)
    expect(high.length).toBeGreaterThanOrEqual(1)
    expect(warning.length).toBeGreaterThanOrEqual(1)

    const umbreon = alerts.find((a) => a.cardId === "sv8pt5-161")
    expect(umbreon).toBeTruthy()
    expect(umbreon!.priority).toBe("critical")
    expect(umbreon!.volumeMultiple).toBeGreaterThanOrEqual(10)
    expect(umbreon!.avgPrice24h).toBeGreaterThan(1000)
    expect(umbreon!.hourlyVolume).toHaveLength(24)
  })

  it("does not flag quiet cards like Miraidon", () => {
    const alerts = detectBuyoutRisks(SEED_BUYOUT_CARDS, buildSeedBuyoutSales())
    expect(alerts.some((a) => a.cardId === "sv1-244")).toBe(false)
  })
})
