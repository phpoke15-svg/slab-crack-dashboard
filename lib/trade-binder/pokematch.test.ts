import { describe, expect, it } from "vitest"
import { blockExclusionSet } from "@/lib/trade-binder/blocks"
import { encodeOfferMessage, parseOfferMessage } from "@/lib/trade-binder/offer-message"
import {
  partnerHasAcceptedTrade,
  tradeHasActiveOffer,
  tradeNeedsMyAcceptance,
  userHasAcceptedTrade,
} from "@/lib/trade-binder/trades"
import type { Trade } from "@/lib/trade-binder/users"

function sampleTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    initiatorId: "user-a",
    recipientId: "user-b",
    status: "pending",
    message: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    initiatorAcceptedAt: null,
    recipientAcceptedAt: null,
    fulfillment: {
      addressesExchangedAt: null,
      trackingSharedAt: null,
      cardsReceivedAt: null,
    },
    shipping: {
      initiatorTracking: "",
      recipientTracking: "",
      initiatorCarrier: "",
      recipientCarrier: "",
      initiatorAddress: "",
      recipientAddress: "",
    },
    cancellation: {
      initiatorCancelledAt: null,
      recipientCancelledAt: null,
    },
    items: [],
    ...overrides,
  }
}

describe("block helpers", () => {
  it("merges blocked and blocked-by ids", () => {
    const set = blockExclusionSet({ blockedIds: ["a"], blockedByIds: ["b"] })
    expect(set.has("a")).toBe(true)
    expect(set.has("b")).toBe(true)
    expect(set.has("c")).toBe(false)
  })
})

describe("offer-message", () => {
  it("round-trips offer payloads", () => {
    const give = [
      {
        cardId: "pikachu-1",
        cardName: "Pikachu",
        cardSet: "Base",
        cardImage: "https://example.com/pika.png",
      },
    ]
    const body = encodeOfferMessage("Fair swap?", give, [])
    const parsed = parseOfferMessage(body)
    expect(parsed).toEqual({ v: 1, note: "Fair swap?", give, get: [] })
  })

  it("rejects invalid offer JSON", () => {
    expect(parseOfferMessage("hello")).toBeNull()
    expect(parseOfferMessage('{"v":2,"give":[],"get":[]}')).toBeNull()
  })
})

describe("trade acceptance helpers", () => {
  it("detects active offers from trade items", () => {
    const empty = sampleTrade()
    const withItems = sampleTrade({
      items: [
        {
          id: "item-1",
          tradeId: "trade-1",
          userId: "user-a",
          cardId: "card-1",
          cardName: "Mew",
          cardSet: "151",
          cardImage: "",
        },
      ],
    })
    expect(tradeHasActiveOffer(empty)).toBe(false)
    expect(tradeHasActiveOffer(withItems)).toBe(true)
  })

  it("tracks per-user acceptance", () => {
    const trade = sampleTrade({
      items: [
        {
          id: "item-1",
          tradeId: "trade-1",
          userId: "user-a",
          cardId: "card-1",
          cardName: "Mew",
          cardSet: "151",
          cardImage: "",
        },
      ],
      initiatorAcceptedAt: "2026-01-02T00:00:00.000Z",
    })
    expect(userHasAcceptedTrade(trade, "user-a")).toBe(true)
    expect(userHasAcceptedTrade(trade, "user-b")).toBe(false)
    expect(partnerHasAcceptedTrade(trade, "user-a")).toBe(false)
    expect(partnerHasAcceptedTrade(trade, "user-b")).toBe(true)
    expect(tradeNeedsMyAcceptance(trade, "user-b")).toBe(true)
    expect(tradeNeedsMyAcceptance(trade, "user-a")).toBe(false)
  })
})
