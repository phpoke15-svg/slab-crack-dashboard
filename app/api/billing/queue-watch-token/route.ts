import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { requireQueueWatchAccess } from "@/lib/billing/stripe"
import { mintQueueWatchToken } from "@/lib/billing/queue-watch-token"

export const dynamic = "force-dynamic"

/** Issue a long-lived token for the PokeWatch bookmarklet (Pro only). */
export async function POST() {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const allowed = await requireQueueWatchAccess(auth.user.id)
  if (!allowed) {
    return NextResponse.json(
      { error: "PokeWatch requires a Pro subscription.", upgradeUrl: "/pricing" },
      { status: 403 },
    )
  }

  const token = mintQueueWatchToken(auth.user.id)
  if (!token) {
    return NextResponse.json({ error: "Token signing is not configured" }, { status: 503 })
  }

  return NextResponse.json({ token })
}
