import { NextResponse } from "next/server"
import { getTopSlabCrackCards } from "@/lib/db/top-ranked-cards"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const cards = await getTopSlabCrackCards(TOP_CARDS_LIMIT)
    return NextResponse.json({
      ok: true,
      limit: TOP_CARDS_LIMIT,
      count: cards.length,
      cards,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load SlabCrack top cards"
    console.error("[slabcrack/top]", message)
    return NextResponse.json({ ok: false, error: message, cards: [] }, { status: 500 })
  }
}
