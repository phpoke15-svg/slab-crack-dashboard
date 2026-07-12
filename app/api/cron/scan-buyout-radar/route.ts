import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { scanBuyoutMarket } from "@/lib/buyout-radar/scan"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily Buyout Radar market scan.
 * Scrapes raw NM eBay sold comps for the chase universe, ingests transactions,
 * then classifies Critical / High / Warning by 24h vs 14-day volume spike.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await scanBuyoutMarket()
    console.log(
      `[buyout-scan] done cards=${result.cardsScanned}/${result.cardsTargeted} sales=${result.salesIngested} alerts=${result.alertCount} errors=${result.errors.length}`,
    )
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Buyout market scan failed"
    console.error("[buyout-scan]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
