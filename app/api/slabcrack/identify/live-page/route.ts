import { NextResponse } from "next/server"
import { identifyLivePage } from "@/lib/slabcrack/identify-live-page"

export const dynamic = "force-dynamic"
export const maxDuration = 60

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

  try {
    const result = await identifyLivePage(image)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live page identify failed"
    const status = /API_KEY|not configured/i.test(message) ? 503 : 422
    console.error("[slabcrack-identify:live-page]", message)
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
