import { NextRequest, NextResponse } from "next/server"
import { updateTradeShipping } from "@/lib/trade-binder/trades"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { tradeId } = await params
  const body = await request.json().catch(() => ({}))
  const tracking = typeof body.tracking === "string" ? body.tracking : ""
  const carrier = typeof body.carrier === "string" ? body.carrier : ""

  const { trade, error } = await updateTradeShipping(
    auth.supabase,
    tradeId,
    auth.user.id,
    tracking,
    carrier,
  )

  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ trade })
}
