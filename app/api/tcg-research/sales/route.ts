import { NextResponse } from "next/server"
import { fetchScrydexSoldComps } from "@/lib/scrydex/listings"
import { isScrydexConfigured, resolveCatalogId } from "@/lib/scrydex/constants"
import { normalizeGradingCompany } from "@/lib/grading/types"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"
import { resolveTcgResearchCardFull } from "@/lib/tcg-research/card-full"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim() || undefined
  const scrydexId = searchParams.get("scrydexId")?.trim() || undefined
  const catalogId = searchParams.get("catalogId")?.trim() || undefined
  const game = parseTcgResearchGame(searchParams.get("game"))
  const company = normalizeGradingCompany(searchParams.get("company"))
  const gradeParam = searchParams.get("grade") ?? "9"
  const rawOnly = searchParams.get("rawOnly") === "1" || searchParams.get("rawOnly") === "true"

  if (!id && !scrydexId && !catalogId) {
    return NextResponse.json({ error: "id, scrydexId, or catalogId required" }, { status: 400 })
  }

  if (!rawOnly && !gradeParam.trim()) {
    return NextResponse.json({ error: "grade is required" }, { status: 400 })
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
      slabGrade: rawOnly ? "9" : gradeParam,
      company,
      rawOnly,
    })

    return NextResponse.json({ ...sales, company, grade: gradeParam, source: "scrydex" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sold comps"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
