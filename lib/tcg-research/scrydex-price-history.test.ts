import { describe, expect, it } from "vitest"
import {
  augmentHistoryWithBundlePrices,
  scrydexHistoryRowsToSeriesMap,
} from "@/lib/tcg-research/scrydex-price-history"

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

describe("augmentHistoryWithBundlePrices", () => {
  it("adds today's PSA grade points from the live bundle when history is raw-only", () => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = augmentHistoryWithBundlePrices(
      [
        {
          snapshot_date: today,
          price_type: "raw",
          variant: "normal",
          condition: "NM",
          market_price: 12,
        },
      ],
      {
        card: { catalog_id: "pokemon-base1-4" },
        raw: [{ variant: "normal", condition: "NM", market_price: 12 }],
        graded: [
          { variant: "normal", company: "PSA", grade: "9", market_price: 90 },
          { variant: "normal", company: "PSA", grade: "10", market_price: 180 },
        ],
      } as never,
    )

    const { series } = scrydexHistoryRowsToSeriesMap(rows, 90)
    expect(series.raw).toEqual([{ date: today, price: 12 }])
    expect(series.psa9).toEqual([{ date: today, price: 90 }])
    expect(series.psa10).toEqual([{ date: today, price: 180 }])
  })
})
