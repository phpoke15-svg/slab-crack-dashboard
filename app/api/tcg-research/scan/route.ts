import { NextResponse } from "next/server"
import { isScrydexConfigured } from "@/lib/scrydex"
import { mapVisionScanErrorStatus } from "@/lib/scrydex/scan-errors"
import { scanTcgResearchCardFromVision } from "@/lib/tcg-research/card-full"
import { parseTcgResearchGame } from "@/lib/tcg-research/search"
import type { TcgGame } from "@/lib/scrydex/types"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!isScrydexConfigured()) {
    return NextResponse.json({ error: "Scrydex Vision is not configured" }, { status: 503 })
  }

  let body: { imageBase64?: string; game?: TcgGame }
  try {
    body = (await request.json()) as { imageBase64?: string; game?: TcgGame }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const imageBase64 = body.imageBase64?.trim()
  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 required" }, { status: 400 })
  }

  const preferredGame = parseTcgResearchGame(body.game ?? null)

  try {
    const payload = await scanTcgResearchCardFromVision({ imageBase64, preferredGame })
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vision scan failed"
    const status = mapVisionScanErrorStatus(error)
    console.error("[tcg-research/scan]", message)
    return NextResponse.json({ error: message }, { status })
  }
}
