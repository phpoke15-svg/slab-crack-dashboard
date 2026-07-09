import { NextRequest, NextResponse } from "next/server"
import { markChatRead } from "@/lib/trade-binder/chat-reads"
import { getTradeById } from "@/lib/trade-binder/trades"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { tradeId } = await params
  const trade = await getTradeById(auth.supabase, tradeId, auth.user.id)
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 })

  await markChatRead(auth.supabase, tradeId, auth.user.id)
  return NextResponse.json({ ok: true })
}
