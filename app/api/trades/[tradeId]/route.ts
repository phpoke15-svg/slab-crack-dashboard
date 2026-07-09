import { NextRequest, NextResponse } from "next/server"
import {
  findTradeThreadBetweenUsers,
  getTradeById,
  listTradeIdsBetweenUsers,
  tradePartnerId,
} from "@/lib/trade-binder/trades"
import { listMessagesForTradeIds } from "@/lib/trade-binder/trade-messages"
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

  const otherId = tradePartnerId(trade, auth.user.id)
  const thread = (await findTradeThreadBetweenUsers(auth.supabase, auth.user.id, otherId)) ?? trade
  const tradeIds = await listTradeIdsBetweenUsers(auth.supabase, auth.user.id, otherId)
  const messages = await listMessagesForTradeIds(auth.supabase, tradeIds)

  return NextResponse.json({ trade: thread, messages })
}
