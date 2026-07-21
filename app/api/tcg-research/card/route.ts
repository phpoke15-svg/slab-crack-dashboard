import { NextResponse } from "next/server"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"
import { resolveTcgResearchCardFull } from "@/lib/tcg-research/card-full"
import { resolveCatalogId } from "@/lib/scrydex/constants"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim() || undefined
  const scrydexId = searchParams.get("scrydexId")?.trim() || undefined
  const catalogId = searchParams.get("catalogId")?.trim() || undefined
  const game = parseTcgResearchGame(searchParams.get("game"))

  if (!id && !scrydexId && !catalogId) {
    return NextResponse.json({ error: "id, scrydexId, or catalogId required" }, { status: 400 })
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

    return NextResponse.json(full, {
      headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
