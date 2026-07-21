import { NextResponse } from "next/server"
import { parseTcgResearchGame, searchTcgResearchCatalog } from "@/lib/tcg-research/search"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const game = parseTcgResearchGame(searchParams.get("game"))

  try {
    const { hits, source } = await searchTcgResearchCatalog(q, game, 40)
    return NextResponse.json({ results: hits, game, source })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ error: message, results: [] }, { status: 500 })
  }
}
