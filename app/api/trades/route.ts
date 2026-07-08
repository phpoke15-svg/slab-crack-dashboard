import { NextRequest, NextResponse } from "next/server"
import { addTradeMessage } from "@/lib/trade-binder/trade-messages"
import { createTrade, listTradesForUser, updateTradeStatus } from "@/lib/trade-binder/trades"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const trades = await listTradesForUser(auth.supabase, auth.user.id)
  return NextResponse.json({ trades })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const recipientId = body.recipientId as string | undefined
  if (!recipientId) return NextResponse.json({ error: "recipientId required" }, { status: 400 })

  const { trade, error } = await createTrade(
    auth.supabase,
    auth.user.id,
    recipientId,
    body.message ?? "",
    body.myItems ?? [],
    body.theirItems ?? [],
  )

  if (error) return NextResponse.json({ error }, { status: 400 })

  if (trade) {
    const note = (body.message ?? "").trim()
    await addTradeMessage(
      auth.supabase,
      trade.id,
      auth.user.id,
      note || "Sent a trade proposal.",
      "proposal",
    )
  }

  return NextResponse.json({ trade })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const tradeId = body.tradeId as string | undefined
  const status = body.status as "accepted" | "declined" | "completed" | "cancelled" | undefined
  if (!tradeId || !status) {
    return NextResponse.json({ error: "tradeId and status required" }, { status: 400 })
  }

  const { error } = await updateTradeStatus(auth.supabase, tradeId, auth.user.id, status)
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
