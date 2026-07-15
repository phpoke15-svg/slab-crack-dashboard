import { NextResponse } from "next/server"
import { detectCardsInFrame } from "@/lib/live-binder-hud/scan-page"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      /** Preferred: raw base64 without data-URL prefix */
      data?: string
      mimeType?: string
      /** Fallback full data URL */
      image?: string
    }

    const hasData = Boolean(body.data && String(body.data).length > 100)
    const hasImage = Boolean(body.image && String(body.image).length > 100)
    if (!hasData && !hasImage) {
      return NextResponse.json(
        { ok: false, error: "Send mimeType + data (base64 without prefix), or image data URL" },
        { status: 400 },
      )
    }

    const result = await detectCardsInFrame({
      data: body.data,
      mimeType: body.mimeType || "image/jpeg",
      image: body.image,
    })

    console.log("[api/live-binder-hud/scan] cards:", result.cards.length, "model:", result.model)

    return NextResponse.json({
      ok: true,
      cards: result.cards,
      model: result.model,
      rawJson: result.rawJson,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed"
    console.error("[api/live-binder-hud/scan] error:", message)
    const status = /not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
