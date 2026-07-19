import { NextRequest, NextResponse } from "next/server"
import { resolveSearchCardPrices } from "@/lib/pricing/persist-search-prices"

export const maxDuration = 15

type PriceInput = {
  id: string
  name: string
  set: string
  cardNumber?: string
}

/** Cache-only batch pricing. Use /api/cards/[id]/price for on-demand lookups. */
export async function POST(request: NextRequest) {
  let cards: PriceInput[] = []

  try {
    const body = (await request.json()) as { cards?: PriceInput[] }
    cards = body.cards ?? []
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (cards.length === 0) {
    return NextResponse.json({ prices: {}, cacheOnly: true })
  }

  try {
    const prices = await resolveSearchCardPrices(cards, { limit: 40 })
    const pricesObj: Record<string, number> = {}
    for (const [id, price] of prices) {
      pricesObj[id] = price
    }

    return NextResponse.json(
      { prices: pricesObj, cacheOnly: true },
      { headers: { "Cache-Control": "private, max-age=300" } },
    )
  } catch (error) {
    console.error("[binder/prices] failed:", error)
    return NextResponse.json({ prices: {}, cacheOnly: true, error: "Price lookup failed" }, { status: 503 })
  }
}
