import { describe, expect, it } from "vitest"
import { parseLivePageCardsJson } from "@/lib/slabcrack/identify-live-page-parse"

describe("parseLivePageCardsJson", () => {
  it("parses boxes with identity", () => {
    const cards = parseLivePageCardsJson(
      JSON.stringify({
        cards: [
          {
            x: 0.1,
            y: 0.2,
            w: 0.25,
            h: 0.35,
            confidence: 0.9,
            cardName: "Umbreon ex",
            setName: "Prismatic Evolutions",
            cardNumber: "161/131",
          },
          { x: 0.4, y: 0.4, w: 0.2, h: 0.3, confidence: 0.8 },
        ],
      }),
      "test",
    )
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      cardName: "Umbreon ex",
      cardNumber: "161",
      x: 0.1,
      y: 0.2,
    })
  })
})
