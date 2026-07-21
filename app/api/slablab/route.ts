import { NextResponse } from "next/server"
import { getSlabItTopSyncedAt, getTopSlabItCards } from "@/lib/db/top-ranked-cards"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"
import { SLABIT_MAX_SET_AGE_YEARS } from "@/lib/slabit-config"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const cards = await getTopSlabItCards(TOP_CARDS_LIMIT)
    const syncedAt = (await getSlabItTopSyncedAt()) ?? new Date().toISOString()
    return NextResponse.json({
      ok: true,
      limit: TOP_CARDS_LIMIT,
      count: cards.length,
      syncedAt,
      maxSetAgeYears: SLABIT_MAX_SET_AGE_YEARS,
      cards,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load SlabLab feed"
    console.error("[slablab]", message)
    return NextResponse.json({ ok: false, error: message, cards: [] }, { status: 500 })
  }
}
