import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { scanBuyoutMarket } from "@/lib/buyout-radar/scan"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily Buyout Radar market scan.
 * Walks the full slab_cards catalog in batches (~200/run), scrapes raw NM
 * eBay sold comps, then classifies Critical / High / Warning by volume spike.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await scanBuyoutMarket()
    console.log(
      `[buyout-scan] done batch=${result.cardsScanned}/${result.cardsTargeted} universe=${result.marketUniverseSize} offset=${result.batchOffset}->${result.nextOffset} sales=${result.salesIngested} alerts=${result.alertCount} errors=${result.errors.length}`,
    )
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Buyout market scan failed"
    console.error("[buyout-scan]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
