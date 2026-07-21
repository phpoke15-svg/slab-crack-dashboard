import { NextResponse } from "next/server"
import { getTopSlabItCards } from "@/lib/db/top-ranked-cards"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const cards = await getTopSlabItCards(TOP_CARDS_LIMIT)
    return NextResponse.json({
      ok: true,
      limit: TOP_CARDS_LIMIT,
      count: cards.length,
      cards,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load SlabLab feed"
    console.error("[slablab]", message)
    return NextResponse.json({ ok: false, error: message, cards: [] }, { status: 500 })
  }
}
