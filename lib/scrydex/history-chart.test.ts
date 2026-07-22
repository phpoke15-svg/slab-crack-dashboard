import { describe, expect, it } from "vitest"
import {
  filterRechartsRowsByType,
  gradeTypeFromHistoryRow,
  gradeTypeToRechartsKey,
  pivotHistoryRowsForChart,
  toRechartsHistoryRows,
} from "@/lib/scrydex/history-chart"

describe("history-chart", () => {
  it("maps raw and PSA grades to chart keys", () => {
    expect(
      gradeTypeFromHistoryRow({
        snapshot_date: "2026-07-01",
        price_type: "raw",
        variant: "normal",
        condition: "NM",
        market_price: 6.5,
      }),
    ).toBe("raw")

    expect(
      gradeTypeFromHistoryRow({
        snapshot_date: "2026-07-01",
        price_type: "graded",
        variant: "normal",
        company: "PSA",
        grade: "10",
        market_price: 45,
      }),
    ).toBe("psa10")
  })

  it("pivots rows by recorded_at for chart libraries", () => {
    const chart = pivotHistoryRowsForChart([
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
        price_type: "raw",
        variant: "normal",
        condition: "NM",
        market_price: 7,
      },
    ])

    expect(chart).toEqual([
      { recorded_at: "2026-07-01", raw: 6.5, psa10: 45 },
      { recorded_at: "2026-07-02", raw: 7 },
    ])
  })

  it("prefers holofoil PSA rows when normal variant is absent", () => {
    const chart = pivotHistoryRowsForChart([
      {
        snapshot_date: "2026-07-01",
        price_type: "raw",
        variant: "holofoil",
        condition: "NM",
        market_price: 878.94,
      },
      {
        snapshot_date: "2026-07-01",
        price_type: "graded",
        variant: "holofoil",
        company: "PSA",
        grade: "10",
        market_price: 2400,
      },
      {
        snapshot_date: "2026-07-01",
        price_type: "graded",
        variant: "normal",
        company: "PSA",
        grade: "10",
        market_price: 100,
      },
    ])

    expect(chart).toEqual([{ recorded_at: "2026-07-01", raw: 878.94, psa10: 100 }])
  })

  it("maps pivot rows to Recharts series keys", () => {
    expect(
      toRechartsHistoryRows([
        { recorded_at: "2026-07-01", raw: 6.5, psa10: 45, psa9: 28 },
      ]),
    ).toEqual([{ recorded_at: "2026-07-01", RAW: 6.5, PSA_10: 45, PSA_9: 28 }])
  })

  it("maps BGS slab grades to Recharts keys", () => {
    expect(gradeTypeToRechartsKey("slab:BGS|9.5")).toBe("BGS_9_5")
    expect(
      toRechartsHistoryRows([
        { recorded_at: "2026-07-01", raw: 6.5, "slab:BGS|9.5": 120 },
      ]),
    ).toEqual([{ recorded_at: "2026-07-01", RAW: 6.5, BGS_9_5: 120 }])
  })

  it("filters rows by type", () => {
    const rows = [{ recorded_at: "2026-07-01", RAW: 6.5, PSA_10: 45 }]
    expect(filterRechartsRowsByType(rows, "raw")).toEqual([{ recorded_at: "2026-07-01", RAW: 6.5 }])
    expect(filterRechartsRowsByType(rows, "graded")).toEqual([{ recorded_at: "2026-07-01", PSA_10: 45 }])
  })
})
