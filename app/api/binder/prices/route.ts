import { NextRequest, NextResponse } from "next/server"
import { getRawPriceByCardId } from "@/lib/db/priced-catalog"

export const maxDuration = 10

type PriceInput = {
  id: string
  name: string
  set: string
  cardNumber?: string
}

/** Serve cached prices only — refreshed by /api/cron/sync-card-prices. */
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

  try {
    const cachedPrices = await getRawPriceByCardId()
    const pricesObj: Record<string, number> = {}

    for (const card of cards) {
      const price = cachedPrices.get(card.id)
      if (price && price > 0) {
        pricesObj[card.id] = price
      }
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
