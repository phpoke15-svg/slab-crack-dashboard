import { NextRequest, NextResponse } from "next/server"
import { updateTradeFulfillmentItem } from "@/lib/trade-binder/trades"
import type { TradeFulfillmentItem } from "@/lib/trade-binder/users"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

const ITEMS: TradeFulfillmentItem[] = [
  "addresses_exchanged",
  "tracking_shared",
  "cards_received",
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { tradeId } = await params
  const body = await request.json().catch(() => ({}))
  const item = body.item as TradeFulfillmentItem | undefined
  const checked = body.checked as boolean | undefined

  if (!item || !ITEMS.includes(item) || typeof checked !== "boolean") {
    return NextResponse.json({ error: "item and checked are required" }, { status: 400 })
  }

  const { trade, error } = await updateTradeFulfillmentItem(
    auth.supabase,
    tradeId,
    auth.user.id,
    item,
    checked,
  )

  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ trade })
}
