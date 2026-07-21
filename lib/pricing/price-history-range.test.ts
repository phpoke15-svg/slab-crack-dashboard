import { describe, expect, it } from "vitest"
import {
  DEFAULT_PRICE_HISTORY_RANGE,
  parsePriceHistoryRange,
  priceHistoryRangeFromDays,
} from "@/lib/pricing/price-history-range"

describe("price history range", () => {
  it("defaults to 30 days", () => {
    expect(parsePriceHistoryRange(null)).toEqual({ key: "30", days: 30, full: false })
    expect(DEFAULT_PRICE_HISTORY_RANGE).toBe("30")
  })

  it("parses preset keys", () => {
    expect(parsePriceHistoryRange("7")).toEqual({ key: "7", days: 7, full: false })
    expect(parsePriceHistoryRange("90")).toEqual({ key: "90", days: 90, full: false })
    expect(parsePriceHistoryRange("180")).toEqual({ key: "180", days: 180, full: false })
    expect(parsePriceHistoryRange("365")).toEqual({ key: "365", days: 365, full: false })
    expect(parsePriceHistoryRange("all")).toEqual({ key: "all", days: 0, full: true })
  })

  it("maps day counts to nearest preset", () => {
    expect(priceHistoryRangeFromDays(30)).toBe("30")
    expect(priceHistoryRangeFromDays(90)).toBe("90")
    expect(priceHistoryRangeFromDays(200)).toBe("180")
    expect(priceHistoryRangeFromDays(0)).toBe("all")
  })
})
