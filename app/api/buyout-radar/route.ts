import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { getBuyoutRadarFeed, persistBuyoutAnomalies } from "@/lib/buyout-radar/store"

export const dynamic = "force-dynamic"

/** Supreme-only live buyout anomaly feed. */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 })
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) {
    return NextResponse.json({ ok: false, error: "Supreme access required" }, { status: 403 })
  }

  try {
    const feed = await getBuyoutRadarFeed()
    const { searchParams } = new URL(request.url)
    if (searchParams.get("persist") === "1" && feed.source === "database") {
      await persistBuyoutAnomalies(feed.alerts)
    }
    return NextResponse.json(feed)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Buyout radar failed"
    console.error("[buyout-radar]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
