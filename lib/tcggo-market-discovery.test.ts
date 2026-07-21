import { describe, expect, it } from "vitest"
import {
  findTcgGoArbitrageCandidates,
  rowToTcgGoArbitrage,
  tcgGoCardToMarketRow,
} from "@/lib/tcggo-market-discovery"
import type { TcgGoCard } from "@/lib/tcggo-api"

describe("tcggo market discovery", () => {
  it("maps tcggo card to market row with USD prices", () => {
    const card: TcgGoCard = {
      id: 1,
      name: "Charizard",
      tcgid: "base1-4",
      card_number: 4,
      episode: { name: "Base Set", code: "base1" },
      prices: {
        tcg_player: { market_price: 400, low_price: 350 },
        ebay: { graded: { psa: { "9": { median_price: 900 }, "10": { median_price: 2000 } } } },
      },
    }

    const row = tcgGoCardToMarketRow(card)
    expect(row?.catalogId).toBe("poke-base1-4")
    expect(row?.rawPrice).toBe(400)
    expect(row?.psa9).toBe(900)
  })

  it("finds arbitrage when graded price is below raw market", () => {
    const candidate = rowToTcgGoArbitrage({
      catalogId: "poke-test-1",
      productName: "Test Card",
      setName: "Test Set",
      cardNumber: "1",
      rawPrice: 100,
      psa7: 0,
      psa8: 0,
      psa9: 75,
      psa10: 0,
    })

    expect(candidate?.deficit).toBe(25)
    expect(candidate?.slabGrade).toBe(9)
  })

  it("filters candidates by min deficit", () => {
    const rows = [
      {
        catalogId: "poke-a",
        productName: "A",
        setName: "Set",
        cardNumber: "1",
        rawPrice: 50,
        psa7: 0,
        psa8: 40,
        psa9: 0,
        psa10: 0,
      },
      {
        catalogId: "poke-b",
        productName: "B",
        setName: "Set",
        cardNumber: "2",
        rawPrice: 50,
        psa7: 0,
        psa8: 48,
        psa9: 0,
        psa10: 0,
      },
    ]

    const found = findTcgGoArbitrageCandidates(rows, { minRawPrice: 10, minDeficit: 5 })
    expect(found).toHaveLength(1)
    expect(found[0]?.catalogId).toBe("poke-a")
  })
})
