import { describe, expect, it } from "vitest"
import { catalogBundleToDailyHistoryRows } from "@/lib/scrydex/webhook-history"

describe("catalogBundleToDailyHistoryRows", () => {
  it("includes holofoil PSA grades in daily history snapshots", () => {
    const rows = catalogBundleToDailyHistoryRows({
      catalogId: "pokemon-swsh8-271",
      raw: [{ variant: "holofoil", condition: "NM", market_price: 878.94 }],
      graded: [
        { variant: "holofoil", company: "PSA", grade: "9", market_price: 950 },
        { variant: "holofoil", company: "PSA", grade: "10", market_price: 2400 },
      ],
    })

    expect(rows.some((row) => row.price_type === "raw" && row.market_price === 878.94)).toBe(true)
    expect(rows.some((row) => row.price_type === "graded" && row.grade === "10" && row.market_price === 2400)).toBe(
      true,
    )
  })
})
