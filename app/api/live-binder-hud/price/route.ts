import { NextResponse } from "next/server"
import { priceBinderCards } from "@/lib/live-binder-hud/price-cards"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      cards?: Array<{ slot?: number; name?: string; set?: string; number?: string }>
      apiKey?: string
    }
    const cards = body.cards
    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ ok: false, error: "cards[] required" }, { status: 400 })
    }
    const headerKey = request.headers.get("x-pricecharting-key") || undefined
    const results = await priceBinderCards(
      cards.map((c) => ({
        slot: Number(c.slot || 0),
        name: String(c.name || ""),
        set: String(c.set || ""),
        number: String(c.number || ""),
      })),
      body.apiKey || headerKey,
    )
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price lookup failed"
    const status = /not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
