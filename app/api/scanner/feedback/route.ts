import { NextResponse } from "next/server"
import { submitScannerMatchFeedback } from "@/lib/scanner/feedback-store"
import { createRouteClient } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

type Body = {
  correct?: boolean
  scanMode?: "single" | "multi"
  presentedCardId?: string
  cardName?: string
  setName?: string
  cardNumber?: string
  matchMethod?: "visual_phash" | "vision"
  matchScore?: number
  batchIndex?: number
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof body.correct !== "boolean") {
    return NextResponse.json({ ok: false, error: "correct (boolean) is required" }, { status: 400 })
  }

  const scanMode = body.scanMode === "multi" ? "multi" : body.scanMode === "single" ? "single" : null
  if (!scanMode) {
    return NextResponse.json(
      { ok: false, error: 'scanMode must be "single" or "multi"' },
      { status: 400 },
    )
  }

  let userId: string | null = null
  try {
    const supabase = await createRouteClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    /* anonymous feedback is fine */
  }

  try {
    const result = await submitScannerMatchFeedback({
      userId,
      correct: body.correct,
      scanMode,
      presentedCardId: body.presentedCardId,
      cardName: body.cardName,
      setName: body.setName,
      cardNumber: body.cardNumber,
      matchMethod: body.matchMethod,
      matchScore: body.matchScore,
      batchIndex: body.batchIndex,
    })
    return NextResponse.json({ ok: true, id: result.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save feedback"
    const status = /not set up yet|not configured/i.test(message) ? 503 : 500
    console.error("[scanner/feedback]", message)
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
