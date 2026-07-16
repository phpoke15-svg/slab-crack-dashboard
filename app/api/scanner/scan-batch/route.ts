import { NextResponse } from "next/server"
import { scanBatchPipeline } from "@/lib/scanner/scan-batch"
import type { BatchScanItemInput } from "@/lib/scanner/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Body = {
  image?: string
  items?: BatchScanItemInput[]
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const image = body.image?.trim()
  const items = Array.isArray(body.items) ? body.items : undefined

  if (!image && (!items || items.length === 0)) {
    return NextResponse.json(
      { ok: false, error: "image or items is required" },
      { status: 400 },
    )
  }

  if (image && image.length > 4_500_000) {
    return NextResponse.json({ ok: false, error: "image is too large" }, { status: 400 })
  }

  if (items && items.length > 9) {
    return NextResponse.json({ ok: false, error: "At most 9 cards per scan" }, { status: 400 })
  }

  try {
    const result = await scanBatchPipeline({ image, items })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch scan failed"
    const status = /API_KEY|not configured/i.test(message)
      ? 503
      : /No cards detected/i.test(message)
        ? 422
        : 500
    console.error("[scanner/scan-batch]", message)
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
