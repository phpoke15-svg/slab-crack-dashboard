import { NextResponse } from "next/server"
import { requireCardScannerAccess } from "@/lib/billing/require-pro"
import { matchDetectedCard, type DetectedCard } from "@/lib/slabcrack/identify-card"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Body = {
  detected?: Partial<DetectedCard>
  source?: "gemini" | "openai"
}

export async function POST(request: Request) {
  const access = await requireCardScannerAccess()
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

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
    const result = await matchDetectedCard(
      body.detected,
      body.source === "openai" ? "openai" : "gemini",
    )
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog match failed"
    const status = /required/i.test(message) ? 400 : 422
    console.error("[slabcrack-identify:match]", message)
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
