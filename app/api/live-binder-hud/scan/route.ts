import { NextResponse } from "next/server"
import { detectCardsInFrame } from "@/lib/live-binder-hud/scan-page"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { image?: string }
    const image = body.image
    if (!image || typeof image !== "string") {
      return NextResponse.json({ ok: false, error: "image data URL required" }, { status: 400 })
    }
    if (image.length > 6_000_000) {
      return NextResponse.json({ ok: false, error: "image too large" }, { status: 400 })
    }
    const result = await detectCardsInFrame(image)
    return NextResponse.json({ ok: true, cards: result.cards, model: result.model })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed"
    const status = /not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
