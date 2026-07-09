import { NextRequest, NextResponse } from "next/server"
import { addTradeMessage, listLatestMessagesForTrades } from "@/lib/trade-binder/trade-messages"
import { encodeOfferMessage } from "@/lib/trade-binder/offer-message"
import {
  createOrUpdateTradeProposal,
  ensureTradeThread,
  listTradeThreadsForUser,
  listTradesForUser,
  updateTradeStatus,
} from "@/lib/trade-binder/trades"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const allTrades = await listTradesForUser(auth.supabase, auth.user.id)
  const threads = listTradeThreadsForUser(allTrades, auth.user.id)
  const lastMessages = await listLatestMessagesForTrades(
    auth.supabase,
    allTrades.map((t) => t.id),
  )
  return NextResponse.json({ trades: threads, allTrades, lastMessages })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const recipientId = body.recipientId as string | undefined
  if (!recipientId) return NextResponse.json({ error: "recipientId required" }, { status: 400 })

  const myItems = body.myItems ?? []
  const theirItems = body.theirItems ?? []
  const hasItems = myItems.length > 0 || theirItems.length > 0
  const note = (body.message ?? "").trim()

  const { trade, error } = hasItems || note
    ? await createOrUpdateTradeProposal(
        auth.supabase,
        auth.user.id,
        recipientId,
        body.message ?? "",
        myItems,
        theirItems,
      )
    : await ensureTradeThread(auth.supabase, auth.user.id, recipientId)

  if (error) return NextResponse.json({ error }, { status: 400 })

  if (trade) {
    if (hasItems) {
      await addTradeMessage(
        auth.supabase,
        trade.id,
        auth.user.id,
        encodeOfferMessage(note, myItems, theirItems),
        "proposal",
      )
    }
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

  const labels: Record<string, string> = {
    accepted: "Accepted the trade offer.",
    declined: "Declined the trade offer.",
    completed: "Marked the trade as completed.",
    cancelled: "Cancelled the trade offer.",
  }
  if (labels[status]) {
    await addTradeMessage(auth.supabase, tradeId, auth.user.id, labels[status], "status")
  }

  return NextResponse.json({ ok: true })
}
