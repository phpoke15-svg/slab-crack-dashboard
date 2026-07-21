import { describe, expect, it } from "vitest"
import {
  crackDeficitForRow,
  gradeSpreadForRow,
  rankCrackArbitrageRows,
  rankSlabItSpreadRows,
  rankedCardRowToCrackEntry,
  rankedCardRowToMockEntry,
} from "@/lib/db/top-ranked-cards"

const baseRow = {
  id: "poke-sv3pt5-173",
  name: "Charizard ex",
  set_name: "151",
  set_id: "sv3pt5",
  number: "173",
  rarity: "Double Rare",
  image_url: "https://example.com/card.png",
  scrydex_id: "sv3pt5-173",
  price_updated_at: "2026-07-21T00:00:00.000Z",
}

describe("market ranking helpers", () => {
  it("ranks crack arbitrage by raw minus PSA 10", () => {
    const rows = rankCrackArbitrageRows(
      [
        { ...baseRow, current_price_raw: 100, current_price_psa10: 90 },
        { ...baseRow, id: "poke-a", current_price_raw: 200, current_price_psa10: 50 },
        { ...baseRow, id: "poke-b", current_price_raw: 40, current_price_psa10: 60 },
      ],
      10,
    )

    expect(rows.map((row) => row.id)).toEqual(["poke-a", "poke-sv3pt5-173"])
    expect(crackDeficitForRow(rows[0]!)).toBe(150)
  })

  it("ranks SlabIt spreads by PSA 10 minus raw", () => {
    const rows = rankSlabItSpreadRows(
      [
        { ...baseRow, current_price_raw: 12, current_price_psa10: 250 },
        { ...baseRow, id: "poke-a", current_price_raw: 20, current_price_psa10: 100 },
        { ...baseRow, id: "poke-b", current_price_raw: 90, current_price_psa10: 80 },
      ],
      10,
    )

    expect(rows.map((row) => row.id)).toEqual(["poke-sv3pt5-173", "poke-a"])
    expect(gradeSpreadForRow(rows[0]!)).toBe(238)
  })
})

describe("rankedCardRowToCrackEntry", () => {
  it("builds crack deficit when raw exceeds PSA 10", () => {
    const entry = rankedCardRowToCrackEntry({
      ...baseRow,
      current_price_raw: 150,
      current_price_psa10: 90,
    })

    expect(entry).not.toBeNull()
    expect(entry?.deficit).toBe(60)
    expect(entry?.percentageSavings).toBe(40)
  })

  it("returns null when PSA 10 is above raw", () => {
    expect(
      rankedCardRowToCrackEntry({
        ...baseRow,
        current_price_raw: 12,
        current_price_psa10: 250,
      }),
    ).toBeNull()
  })
})

describe("rankedCardRowToMockEntry", () => {
  it("returns null when prices are missing", () => {
    expect(
      rankedCardRowToMockEntry({
        ...baseRow,
        current_price_raw: null,
        current_price_psa10: null,
      }),
    ).toBeNull()
  })
})
