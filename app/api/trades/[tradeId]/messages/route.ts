import { NextRequest, NextResponse } from "next/server"
import { addTradeMessage, listTradeMessages } from "@/lib/trade-binder/trade-messages"
import { getTradeById } from "@/lib/trade-binder/trades"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { tradeId } = await params
  const trade = await getTradeById(auth.supabase, tradeId, auth.user.id)
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 })

  const messages = await listTradeMessages(auth.supabase, tradeId)
  return NextResponse.json({ messages })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { tradeId } = await params
  const trade = await getTradeById(auth.supabase, tradeId, auth.user.id)
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const { message, error } = await addTradeMessage(
    auth.supabase,
    tradeId,
    auth.user.id,
    body.body ?? "",
    body.messageType ?? "text",
  )

  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ message })
}
