import { describe, expect, it } from "vitest"
import { scrydexHistoryRowsToSeriesMap } from "@/lib/tcg-research/scrydex-price-history"

describe("scrydexHistoryRowsToSeriesMap", () => {
  it("groups daily history into raw and PSA series", () => {
    const { series } = scrydexHistoryRowsToSeriesMap(
      [
        {
          snapshot_date: "2026-07-01",
          price_type: "raw",
          variant: "normal",
          condition: "NM",
          market_price: 40,
        },
        {
          snapshot_date: "2026-07-02",
          price_type: "raw",
          variant: "normal",
          condition: "NM",
          market_price: 42,
        },
        {
          snapshot_date: "2026-07-02",
          price_type: "graded",
          variant: "normal",
          company: "PSA",
          grade: "10",
          market_price: 180,
        },
      ],
      90,
    )

    expect(series.raw).toEqual([
      { date: "2026-07-01", price: 40 },
      { date: "2026-07-02", price: 42 },
    ])
    expect(series.psa10).toEqual([{ date: "2026-07-02", price: 180 }])
  })
})
