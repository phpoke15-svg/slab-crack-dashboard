import { NextRequest, NextResponse } from "next/server"
import { getCatalogCardById } from "@/lib/db/cards-catalog"
import { getLazyCardPrice } from "@/lib/pricing/lazy-card-price"
import { ensureCardPriceHistory } from "@/lib/pricing/lazy-price-history"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const cardId = decodeURIComponent(id).trim()

  if (!cardId) {
    return NextResponse.json({ error: "Card id is required" }, { status: 400 })
  }

  const card = await getCatalogCardById(cardId)
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 })
  }

  try {
    const [price] = await Promise.all([
      getLazyCardPrice(card),
      ensureCardPriceHistory(cardId, { days: 30 }).catch(() => null),
    ])
    return NextResponse.json(price, {
      headers: { "Cache-Control": "private, max-age=300" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price lookup failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
