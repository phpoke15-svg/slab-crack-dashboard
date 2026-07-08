import { NextRequest, NextResponse } from "next/server"
import { addTradeMessage } from "@/lib/trade-binder/trade-messages"
import { getTradeById, replaceTradeItems } from "@/lib/trade-binder/trades"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { tradeId } = await params
  const trade = await getTradeById(auth.supabase, tradeId, auth.user.id)
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 })
  if (trade.status !== "pending") {
    return NextResponse.json({ error: "Trade is not open for counter-offers" }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const myItems = body.myItems ?? []
  const theirItems = body.theirItems ?? []

  if (myItems.length === 0 && theirItems.length === 0) {
    return NextResponse.json({ error: "Select at least one card" }, { status: 400 })
  }

  const isInitiator = trade.initiatorId === auth.user.id
  const initiatorItems = isInitiator ? myItems : theirItems
  const recipientItems = isInitiator ? theirItems : myItems

  const { error: replaceError } = await replaceTradeItems(
    auth.supabase,
    tradeId,
    auth.user.id,
    trade.initiatorId,
    trade.recipientId,
    initiatorItems,
    recipientItems,
  )
  if (replaceError) return NextResponse.json({ error: replaceError }, { status: 400 })

  const note = (body.message as string | undefined)?.trim()
  if (note) {
    await addTradeMessage(auth.supabase, tradeId, auth.user.id, note, "counter")
  } else {
    await addTradeMessage(
      auth.supabase,
      tradeId,
      auth.user.id,
      "Updated the trade offer.",
      "counter",
    )
  }

  const updated = await getTradeById(auth.supabase, tradeId, auth.user.id)
  return NextResponse.json({ trade: updated })
}
