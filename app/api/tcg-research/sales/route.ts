import { NextResponse } from "next/server"
import { fetchScrydexSoldComps } from "@/lib/scrydex/listings"
import { isScrydexConfigured, resolveCatalogId } from "@/lib/scrydex/constants"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"
import { resolveTcgResearchCardFull } from "@/lib/tcg-research/card-full"

export const dynamic = "force-dynamic"
export const maxDuration = 45

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim() || undefined
  const scrydexId = searchParams.get("scrydexId")?.trim() || undefined
  const catalogId = searchParams.get("catalogId")?.trim() || undefined
  const game = parseTcgResearchGame(searchParams.get("game"))
  const gradeParam = searchParams.get("grade") ?? "9"
  const rawOnly = searchParams.get("rawOnly") === "1" || searchParams.get("rawOnly") === "true"
  const slabGrade = Number(gradeParam)

  if (!id && !scrydexId && !catalogId) {
    return NextResponse.json({ error: "id, scrydexId, or catalogId required" }, { status: 400 })
  }

  if (!rawOnly && (!Number.isFinite(slabGrade) || slabGrade < 7 || slabGrade > 10)) {
    return NextResponse.json({ error: "grade must be 7–10" }, { status: 400 })
  }

  if (!isScrydexConfigured()) {
    return NextResponse.json({ error: "SCRYDEX_API_KEY and SCRYDEX_TEAM_ID must be configured" }, { status: 503 })
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

    const sales = await fetchScrydexSoldComps({
      catalogId: full.catalogId,
      scrydexId: full.scrydexId,
      game: full.game,
      slabGrade: rawOnly ? 9 : slabGrade,
      rawOnly,
    })

    return NextResponse.json({ ...sales, source: "scrydex" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sold comps"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
