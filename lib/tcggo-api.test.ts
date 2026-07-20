import { afterEach, describe, expect, it } from "vitest"
import {
  extractTcgGoCardPrices,
  parseTcgGoHistoryPoints,
  pokemonTcgIdFromCardId,
} from "@/lib/tcggo-api"
import { getActivePriceProvider } from "@/lib/pricing/provider"

describe("pokemonTcgIdFromCardId", () => {
  it("strips poke- prefix", () => {
    expect(pokemonTcgIdFromCardId("poke-sv3pt5-173")).toBe("sv3pt5-173")
  })
})

describe("extractTcgGoCardPrices", () => {
  it("prefers tcgplayer market price for raw", () => {
    const prices = extractTcgGoCardPrices({
      prices: {
        tcg_player: { market_price: 84.99, mid_price: 90 },
        ebay: {
          graded: {
            psa: {
              "10": { median_price: 250 },
              "9": { median_price: 120 },
              "8": { median_price: 70 },
              "7": { median_price: 35 },
            },
          },
        },
      },
    })

    expect(prices.rawPrice).toBe(84.99)
    expect(prices.psa10Price).toBe(250)
    expect(prices.psa9Price).toBe(120)
    expect(prices.psa8Price).toBe(70)
    expect(prices.psa7Price).toBe(35)
  })
})

describe("parseTcgGoHistoryPoints", () => {
  it("parses date-keyed tcggo history payloads", () => {
    const points = parseTcgGoHistoryPoints({
      data: {
        "2026-07-01": { tcg_player_market: 70, cm_low: 65 },
        "2026-07-02": { tcg_player_market: 75, cm_low: 72 },
      },
      paging: { current: 1, total: 1, per_page: 30 },
    })

    expect(points).toEqual([
      { date: "2026-07-01", grade: 0, price: 70 },
      { date: "2026-07-02", grade: 0, price: 75 },
    ])
  })

  it("parses legacy array history rows", () => {
    const points = parseTcgGoHistoryPoints({
      data: [
        { date: "2026-07-01", market_price: 70 },
        { date: "2026-07-02", market_price: 75, psa10_price: 220 },
      ],
    })

    expect(points).toEqual(
      expect.arrayContaining([
        { date: "2026-07-01", grade: 0, price: 70, saleCount: undefined },
        { date: "2026-07-02", grade: 0, price: 75, saleCount: undefined },
        { date: "2026-07-02", grade: 10, price: 220, saleCount: undefined },
      ]),
    )
  })
})

describe("getActivePriceProvider", () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  it("prefers tcggo when both keys are set in auto mode", () => {
    process.env.PRICE_PROVIDER = "auto"
    process.env.RAPIDAPI_POKEMON_TCG_KEY = "rapid-key"
    process.env.PRICECHARTING_API_KEY = "pc-key"
    expect(getActivePriceProvider()).toBe("tcggo")
  })
})
