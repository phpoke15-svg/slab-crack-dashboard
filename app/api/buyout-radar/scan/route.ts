import { NextResponse } from "next/server"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { scanBuyoutMarket } from "@/lib/buyout-radar/scan"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Supreme-only manual trigger for the daily Buyout Radar market scan. */
export async function POST() {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 })
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) {
    return NextResponse.json({ ok: false, error: "Supreme access required" }, { status: 403 })
  }

  try {
    const result = await scanBuyoutMarket()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Buyout market scan failed"
    console.error("[buyout-scan] manual:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
