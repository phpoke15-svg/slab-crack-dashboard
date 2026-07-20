import { NextRequest, NextResponse } from "next/server"
import { enrichSearchCardPrices } from "@/lib/pricing/persist-search-prices"

export const maxDuration = 60

type PriceInput = {
  id: string
  name: string
  set: string
  cardNumber?: string
  rawPrice?: number
}

/** Batch pricing: cache first, then live PriceCharting for unpriced cards. */
export async function POST(request: NextRequest) {
  let cards: PriceInput[] = []
  let cacheOnly = false

  try {
    const body = (await request.json()) as { cards?: PriceInput[]; cacheOnly?: boolean }
    cards = body.cards ?? []
    cacheOnly = body.cacheOnly === true
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (cards.length === 0) {
    return NextResponse.json({ prices: {}, cacheOnly })
  }

  try {
    const prices = await enrichSearchCardPrices(cards, {
      limit: Math.min(cards.length, 80),
      cacheOnly,
    })
    const pricesObj: Record<string, number> = {}
    for (const [id, price] of prices) {
      pricesObj[id] = price
    }

    return NextResponse.json(
      { prices: pricesObj, cacheOnly },
      { headers: { "Cache-Control": cacheOnly ? "private, max-age=300" : "private, no-store" } },
    )
  } catch (error) {
    console.error("[binder/prices] failed:", error)
    return NextResponse.json({ prices: {}, cacheOnly, error: "Price lookup failed" }, { status: 503 })
  }
}
