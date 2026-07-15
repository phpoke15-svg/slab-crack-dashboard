import { NextResponse } from "next/server"
import { syncUserWatchlist } from "@/lib/db/user-watchlist"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

type Body = {
  tool?: "slabcrack" | "slablab"
  items?: Array<{ watchlistId?: string; cardName?: string }>
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as Body
  if (body.tool !== "slabcrack" && body.tool !== "slablab") {
    return NextResponse.json({ error: "tool must be slabcrack or slablab" }, { status: 400 })
  }

  const items = (body.items ?? [])
    .map((item) => ({
      watchlistId: item.watchlistId?.trim() ?? "",
      cardName: item.cardName?.trim() ?? "Card",
      tool: body.tool!,
    }))
    .filter((item) => item.watchlistId.length > 0)

  await syncUserWatchlist(auth.user.id, body.tool, items)
  return NextResponse.json({ ok: true, count: items.length })
}
