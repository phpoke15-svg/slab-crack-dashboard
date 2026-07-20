import { describe, expect, it } from "vitest"
import { parseTcgGoHistoryPoints } from "@/lib/tcggo-api"

describe("parseTcgGoHistoryPoints graded rows", () => {
  it("extracts PSA 7-10 from rows without explicit grade", () => {
    const points = parseTcgGoHistoryPoints({
      data: [
        {
          date: "2026-01-01",
          tcg_player_market: 7,
          psa7_price: 40,
          psa8_price: 55,
          psa9_price: 80,
          psa10_price: 150,
        },
      ],
    })

    expect(points).toEqual(
      expect.arrayContaining([
        { date: "2026-01-01", grade: 0, price: 7, saleCount: undefined },
        { date: "2026-01-01", grade: 7, price: 40, saleCount: undefined },
        { date: "2026-01-01", grade: 8, price: 55, saleCount: undefined },
        { date: "2026-01-01", grade: 9, price: 80, saleCount: undefined },
        { date: "2026-01-01", grade: 10, price: 150, saleCount: undefined },
      ]),
    )
  })
})
