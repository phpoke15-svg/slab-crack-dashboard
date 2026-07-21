import { NextResponse } from "next/server"
import { isScrydexConfigured, resolveScanToCatalog } from "@/lib/scrydex"
import { mapVisionScanErrorStatus } from "@/lib/scrydex/scan-errors"
import { visionScanGameScope } from "@/lib/scrydex/vision-pipeline"
import type { TcgGame } from "@/lib/scrydex/types"

export const runtime = "nodejs"
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

  const requested = (body.preferredGames ?? ["pokemon"]).filter((g) => GAMES.has(g))
  const preferredGame = requested[0] ?? "pokemon"

  try {
    const result = await resolveScanToCatalog({
      imageBase64,
      preferredGames: visionScanGameScope(preferredGame),
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vision scan failed"
    console.error("[catalog/vision]", message)
    return NextResponse.json({ error: message }, { status: mapVisionScanErrorStatus(error) })
  }
}
