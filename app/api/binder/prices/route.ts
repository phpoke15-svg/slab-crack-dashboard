import { NextRequest, NextResponse } from "next/server"
import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import { attachBinderCardPrices } from "@/lib/trade-binder/binder-prices"

export const maxDuration = 10

type PriceInput = {
  id: string
  name: string
  set: string
  cardNumber?: string
}

export async function POST(request: NextRequest) {
  let cards: PriceInput[] = []

  try {
    const body = (await request.json()) as { cards?: PriceInput[] }
    cards = body.cards ?? []
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (cards.length === 0) {
    return NextResponse.json({ prices: {} })
  }

  if (!process.env.PRICECHARTING_API_KEY) {
    return NextResponse.json(
      { prices: {}, error: "PRICECHARTING_API_KEY is not configured" },
      { status: 503 },
    )
  }

  try {
    const cachedPrices = await getRawPriceByCardId()
    const prices = await attachBinderCardPrices(cards, {
      cachedPrices,
      limit: 20,
      concurrency: 2,
    })

    const pricesObj: Record<string, number> = {}
    for (const [id, price] of prices) {
      pricesObj[id] = price
    }

    if (prices.size > 0) {
      const { upsertBinderCardPrices } = await import("@/lib/db/binder-card-prices")
      await upsertBinderCardPrices(
        cards
          .map((card) => {
            const rawPrice = prices.get(card.id) ?? 0
            if (rawPrice <= 0) return null
            return {
              cardId: card.id,
              rawPrice,
              cardName: card.name,
              cardSet: card.set,
              cardNumber: card.cardNumber,
            }
          })
          .filter((row): row is NonNullable<typeof row> => row !== null),
      ).catch((error) => {
        console.warn("[binder/prices] cache upsert failed:", error)
      })
    }

    return NextResponse.json(
      { prices: pricesObj },
      { headers: { "Cache-Control": "private, max-age=900" } },
    )
  } catch (error) {
    console.error("[binder/prices] failed:", error)
    return NextResponse.json({ prices: {}, error: "Price lookup failed" }, { status: 503 })
  }
}
