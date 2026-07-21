import { describe, expect, it } from "vitest"
import {
  extractScrydexWebhookPrices,
  normalizeScrydexWebhookEventName,
  readScrydexWebhookId,
} from "@/lib/scrydex/webhook-payload"

describe("normalizeScrydexWebhookEventName", () => {
  it("normalizes card-level event names", () => {
    expect(normalizeScrydexWebhookEventName("card.price_updated")).toBe("card.price_updated")
    expect(normalizeScrydexWebhookEventName("pokemon.card.price_updated")).toBe("card.price_updated")
    expect(normalizeScrydexWebhookEventName("card.created")).toBe("card.created")
  })
})

describe("readScrydexWebhookId", () => {
  it("reads nested card ids", () => {
    expect(readScrydexWebhookId({ scrydex_id: "sv3pt5-173" })).toBe("sv3pt5-173")
    expect(readScrydexWebhookId({ card: { id: "base1-4" } })).toBe("base1-4")
  })
})

describe("extractScrydexWebhookPrices", () => {
  it("reads direct price fields", () => {
    expect(
      extractScrydexWebhookPrices({
        current_price_raw: 12.5,
        current_price_psa10: 99,
      }),
    ).toEqual({ raw: 12.5, psa10: 99 })
  })

  it("reads price_raw and price_psa10 aliases", () => {
    expect(
      extractScrydexWebhookPrices({
        price_raw: 6.5,
        price_psa10: 45,
      }),
    ).toEqual({ raw: 6.5, psa10: 45 })
  })

  it("extracts raw and PSA 10 prices from variants", () => {
    expect(
      extractScrydexWebhookPrices({
        variants: [
          {
            name: "normal",
            prices: [
              { type: "raw", condition: "NM", market: 15.25 },
              { type: "graded", company: "PSA", grade: "10", market: 120 },
            ],
          },
        ],
      }),
    ).toEqual({ raw: 15.25, psa10: 120 })
  })

  it("prefers market over low and never uses mid for raw NM", () => {
    expect(
      extractScrydexWebhookPrices({
        variants: [
          {
            name: "normal",
            prices: [{ type: "raw", condition: "NM", market: 7.5, mid: 19.97, low: 6.06 }],
          },
        ],
      }),
    ).toEqual({ raw: 7.5, psa10: null })
  })

  it("falls back to low when market is missing", () => {
    expect(
      extractScrydexWebhookPrices({
        variants: [
          {
            name: "normal",
            prices: [{ type: "raw", condition: "NM", mid: 19.97, low: 6.06 }],
          },
        ],
      }),
    ).toEqual({ raw: 6.06, psa10: null })
  })
})
