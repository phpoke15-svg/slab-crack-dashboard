import { NextRequest, NextResponse } from "next/server"
import { getRawPriceByCardId } from "@/lib/db/priced-catalog"
import {
  binderPriceInputsFromCards,
  resolveSearchCardPrices,
} from "@/lib/pricing/persist-search-prices"
import { attachBinderCardPrices } from "@/lib/trade-binder/binder-prices"

export const maxDuration = 30

type PriceInput = {
  id: string
  name: string
  set: string
  cardNumber?: string
}

/**
 * Cache-first card pricing for search/binder flows.
 * Live PriceCharting fallback fills gaps (English + Japanese via PC search).
 */
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
    const cachedPrices = await getRawPriceByCardId()
    const pricesObj: Record<string, number> = {}
    for (const card of cards) {
      const price = cachedPrices.get(card.id)
      if (price && price > 0) pricesObj[card.id] = price
    }
    return NextResponse.json(
      { prices: pricesObj, error: "PRICECHARTING_API_KEY is not configured" },
      { status: 503 },
    )
  }

  try {
    const prices = await resolveSearchCardPrices(cards, { limit: 20, concurrency: 2 })

    const pricesObj: Record<string, number> = {}
    for (const [id, price] of prices) {
      pricesObj[id] = price
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
