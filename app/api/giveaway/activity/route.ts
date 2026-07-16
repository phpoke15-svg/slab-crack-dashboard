import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { recordActiveTime } from "@/lib/giveaway/service"

export const dynamic = "force-dynamic"

type Body = { minutes?: number }

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const minutes = Number(body.minutes)
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 30) {
    return NextResponse.json(
      { ok: false, error: "minutes must be between 1 and 30" },
      { status: 400 },
    )
  }

  try {
    const result = await recordActiveTime(auth.user.id, Math.round(minutes))
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record activity"
    const status = /not set up yet|not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
