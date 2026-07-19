import { NextResponse } from "next/server"
import { getSlabPopCatalog } from "@/lib/card-filters/slabpop-catalog"
import { getCatalogCardCount } from "@/lib/db/cards-catalog"

export const maxDuration = 30

export async function GET() {
  try {
    const [cards, catalogReady] = await Promise.all([
      getSlabPopCatalog(),
      getCatalogCardCount().then((count) => count > 0),
    ])

    const live = cards.some((card) => card.popSource !== "demo")

    return NextResponse.json(
      {
        cards,
        catalogReady,
        source: live ? "live" : "demo",
        count: cards.length,
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    )
  } catch (error) {
    console.error("[slabpop/catalog] failed:", error)
    return NextResponse.json(
      { cards: [], catalogReady: false, source: "demo", count: 0, error: "Catalog unavailable" },
      { status: 503 },
    )
  }
}
