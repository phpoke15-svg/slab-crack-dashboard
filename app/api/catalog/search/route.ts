import { NextResponse } from "next/server"
import { createCatalogService, isScrydexConfigured } from "@/lib/scrydex"
import type { TcgGame } from "@/lib/scrydex/types"

export const dynamic = "force-dynamic"

const GAMES = new Set<TcgGame>(["pokemon", "lorcana", "mtg"])

export async function GET(request: Request) {
  if (!isScrydexConfigured()) {
    return NextResponse.json({ error: "Scrydex is not configured" }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const game = searchParams.get("game") as TcgGame | null
  const q = searchParams.get("q")?.trim() ?? ""
  const page = Math.max(Number(searchParams.get("page") ?? 1) || 1, 1)
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? 24) || 24, 1), 100)

  if (!game || !GAMES.has(game)) {
    return NextResponse.json({ error: "game must be pokemon, lorcana, or mtg" }, { status: 400 })
  }

  try {
    const service = createCatalogService()
    const result = await service.search({ game, q, page, pageSize })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog search failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
