import { describe, expect, it, vi } from "vitest"
import { toRechartsHistoryRows } from "@/lib/scrydex/history-chart"

vi.mock("@/lib/pricing/card-daily-price-history", () => ({
  ensureCardDailyPriceHistory: vi.fn().mockResolvedValue({ reason: "cached" }),
}))

vi.mock("@/lib/scrydex/db", () => ({
  loadDailyHistoryRows: vi.fn().mockResolvedValue([
    {
      snapshot_date: "2026-07-01",
      price_type: "raw",
      variant: "normal",
      condition: "NM",
      market_price: 6.5,
    },
    {
      snapshot_date: "2026-07-01",
      price_type: "graded",
      variant: "normal",
      company: "PSA",
      grade: "10",
      market_price: 45,
    },
    {
      snapshot_date: "2026-07-02",
      price_type: "graded",
      variant: "normal",
      company: "PSA",
      grade: "9",
      market_price: 28,
    },
  ]),
}))

describe("loadScrydexPriceHistoryChart", () => {
  it("returns Recharts rows keyed by recorded_at with RAW and PSA grades", async () => {
    const { loadScrydexPriceHistoryChart } = await import("@/lib/scrydex/history-loader")
    const result = await loadScrydexPriceHistoryChart({
      scrydexId: "mep-41",
      game: "pokemon",
      days: 90,
      backfill: false,
    })

    expect(result.catalogId).toBe("pokemon-mep-41")
    expect(result.rows).toEqual(
      toRechartsHistoryRows([
        { recorded_at: "2026-07-01", raw: 6.5, psa10: 45 },
        { recorded_at: "2026-07-02", psa9: 28 },
      ]),
    )
  })
})
