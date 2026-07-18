import { NextResponse } from "next/server"
import { matchCatalogFromOcr } from "@/lib/scanner/catalog-match"
import type { DetectedCard } from "@/lib/slabcrack/identify-parse"

export const dynamic = "force-dynamic"
export const maxDuration = 15

type Body = {
  detected?: Partial<DetectedCard>
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.detected || typeof body.detected !== "object") {
    return NextResponse.json({ ok: false, error: "detected card object is required" }, { status: 400 })
  }

  try {
    const result = await matchCatalogFromOcr(body.detected)
    if (!result) {
      return NextResponse.json({ ok: false, error: "No catalog match" }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog match failed"
    console.error("[scanner:match]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 422 })
  }
}
