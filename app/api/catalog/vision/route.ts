import { NextResponse } from "next/server"
import { isScrydexConfigured, resolveScanToCatalog } from "@/lib/scrydex"
import type { TcgGame } from "@/lib/scrydex/types"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const GAMES = new Set<TcgGame>(["pokemon", "lorcana", "mtg"])

export async function POST(request: Request) {
  if (!isScrydexConfigured()) {
    return NextResponse.json({ error: "Scrydex is not configured" }, { status: 503 })
  }

  let body: { imageBase64?: string; preferredGames?: TcgGame[] }
  try {
    body = (await request.json()) as { imageBase64?: string; preferredGames?: TcgGame[] }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const imageBase64 = body.imageBase64?.trim()
  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 required" }, { status: 400 })
  }

  const preferredGames = (body.preferredGames ?? ["pokemon", "lorcana", "mtg"]).filter((g) => GAMES.has(g))

  try {
    const result = await resolveScanToCatalog({ imageBase64, preferredGames })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vision scan failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
