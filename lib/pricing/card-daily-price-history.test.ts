import { describe, expect, it } from "vitest"
import { scrydexHistoryRowsToSeriesMap } from "@/lib/tcg-research/scrydex-price-history"

describe("card daily price history series", () => {
  it("builds multi-day raw and PSA series from price_history_daily rows", () => {
    const rows = [
      {
        snapshot_date: "2026-01-01",
        price_type: "raw",
        variant: "normal",
        condition: "NM",
        market_price: 10,
      },
      {
        snapshot_date: "2026-01-02",
        price_type: "raw",
        variant: "normal",
        condition: "NM",
        market_price: 12,
      },
      {
        snapshot_date: "2026-01-01",
        price_type: "graded",
        variant: "normal",
        company: "PSA",
        grade: "10",
        market_price: 40,
      },
      {
        snapshot_date: "2026-01-02",
        price_type: "graded",
        variant: "normal",
        company: "PSA",
        grade: "10",
        market_price: 42,
      },
    ]

    const { series } = scrydexHistoryRowsToSeriesMap(rows, 0)
    expect(series.raw).toHaveLength(2)
    expect(series.psa10).toHaveLength(2)
    expect(series.raw[0]?.date).toBe("2026-01-01")
    expect(series.raw[1]?.date).toBe("2026-01-02")
    expect(series.raw.map((point) => point.price)).toEqual([10, 12])
    expect(series.psa10.map((point) => point.price)).toEqual([40, 42])
  })
})
