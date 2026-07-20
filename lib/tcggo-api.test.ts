import { afterEach, describe, expect, it } from "vitest"
import {
  extractTcgGoCardPrices,
  parseTcgGoHistoryPoints,
  pokemonTcgIdFromCardId,
  tcgGoCardMatchesTarget,
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

  it("ignores cardmarket-only prices (EUR)", () => {
    const prices = extractTcgGoCardPrices({
      prices: {
        cardmarket: {
          lowest_near_mint: 12.5,
          "7d_average": 14,
          graded: { psa: { psa10: 200, psa9: 90 } },
        },
      },
    })

    expect(prices.rawPrice).toBe(0)
    expect(prices.psa10Price).toBe(0)
    expect(prices.psa9Price).toBe(0)
  })

  it("ignores tcgplayer mid_price (listing median, not market)", () => {
    const prices = extractTcgGoCardPrices({
      prices: {
        tcg_player: { mid_price: 19.97 },
      },
    })

    expect(prices.rawPrice).toBe(0)
  })

  it("uses tcgplayer market_price only, not mid_price", () => {
    const prices = extractTcgGoCardPrices({
      prices: {
        tcg_player: { market_price: 6.38, mid_price: 19.97 },
      },
    })

    expect(prices.rawPrice).toBe(6.38)
  })

  it("falls back to tcgplayer low_price when market is missing", () => {
    const prices = extractTcgGoCardPrices({
      prices: {
        tcg_player: { low_price: 6.06, mid_price: 19.97 },
      },
    })

    expect(prices.rawPrice).toBe(6.06)
  })
})

describe("tcgGoCardMatchesTarget", () => {
  it("matches chimchar mep-41", () => {
    expect(
      tcgGoCardMatchesTarget(
        { name: "Chimchar", card_number: "41", tcgid: "mep-41" },
        { cardName: "Chimchar", cardNumber: "41" },
      ),
    ).toBe(true)
  })

  it("rejects wrong card for chimchar mep-41", () => {
    expect(
      tcgGoCardMatchesTarget(
        { name: "Pikachu at the Museum", card_number: "41", tcgid: "mep-41" },
        { cardName: "Chimchar", cardNumber: "41" },
      ),
    ).toBe(false)
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

  it("ignores cardmarket-only history rows", () => {
    const points = parseTcgGoHistoryPoints({
      data: {
        "2026-07-01": { cm_low: 65, lowest_near_mint: 60, average_price: 62 },
        "2026-07-02": { tcg_player_market: 75 },
      },
    })

    expect(points).toEqual([{ date: "2026-07-02", grade: 0, price: 75 }])
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
