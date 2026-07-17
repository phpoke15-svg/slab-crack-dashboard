import { NextResponse } from "next/server"
import { scanCardPipeline } from "@/lib/scanner/scan-pipeline"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Body = {
  image?: string
  phash?: string
  forceVision?: boolean
  detected?: {
    cardName?: string
    setName?: string
    cardNumber?: string
    confidence?: number
  }
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const image = body.image?.trim()
  const hasDetected = Boolean(body.detected?.cardName?.trim() || body.detected?.cardNumber?.trim())

  if (!image && !hasDetected) {
    return NextResponse.json(
      { ok: false, error: "image (data URL) or detected card fields are required" },
      { status: 400 },
    )
  }

  try {
    const result = await scanCardPipeline({
      image: image ?? "",
      phash: body.phash,
      detected: body.detected,
      forceVision: body.forceVision === true,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed"
    const status = /API_KEY|not configured/i.test(message) ? 503 : 422
    console.error("[scanner/scan]", message)
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
