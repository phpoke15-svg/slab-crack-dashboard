import { NextResponse } from "next/server"
import { fetchRecentSalesForCard } from "@/lib/ebay-sold"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"
import { resolveTcgResearchCardFull, tcgResearchSalesCard } from "@/lib/tcg-research/card-full"
import { resolveCatalogId } from "@/lib/scrydex/constants"

export const dynamic = "force-dynamic"
export const maxDuration = 45

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim() || undefined
  const scrydexId = searchParams.get("scrydexId")?.trim() || undefined
  const catalogId = searchParams.get("catalogId")?.trim() || undefined
  const game = parseTcgResearchGame(searchParams.get("game"))
  const gradeParam = searchParams.get("grade") ?? "9"
  const slabGrade = Number(gradeParam)

  if (!id && !scrydexId && !catalogId) {
    return NextResponse.json({ error: "id, scrydexId, or catalogId required" }, { status: 400 })
  }

  if (!Number.isFinite(slabGrade) || slabGrade < 7 || slabGrade > 10) {
    return NextResponse.json({ error: "grade must be 7–10" }, { status: 400 })
  }

  const apiKey = process.env.EBAY_SOLD_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "EBAY_SOLD_API_KEY is not configured" }, { status: 503 })
  }

  try {
    const full = await resolveTcgResearchCardFull({
      id: id ?? (catalogId ? resolveCatalogId(catalogId) ?? catalogId : undefined),
      scrydexId,
      catalogId,
      game,
    })

    if (!full) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    const sales = await fetchRecentSalesForCard(apiKey, tcgResearchSalesCard(full), slabGrade)
    return NextResponse.json(sales)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sold comps"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
