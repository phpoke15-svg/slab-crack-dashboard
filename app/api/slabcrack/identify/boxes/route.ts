import { NextResponse } from "next/server"
import { detectCardBoxes } from "@/lib/slabcrack/detect-card-boxes"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Body = {
  image?: string
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const image = body.image?.trim()
  if (!image) {
    return NextResponse.json({ ok: false, error: "image (data URL) is required" }, { status: 400 })
  }
  if (image.length > 4_500_000) {
    return NextResponse.json({ ok: false, error: "image is too large" }, { status: 400 })
  }

  try {
    const result = await detectCardBoxes(image)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Card box detection failed"
    const status = /API_KEY|not configured/i.test(message) ? 503 : 422
    console.error("[slabcrack-identify:boxes]", message)
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
