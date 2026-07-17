import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { syncUnifiedCardPrices } from "@/lib/pricing/sync"

export const maxDuration = 300
export const dynamic = "force-dynamic"

/** Unified daily price sync — writes card_prices + price_history. */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await syncUnifiedCardPrices()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unified card price sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
