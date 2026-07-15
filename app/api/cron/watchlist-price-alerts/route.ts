import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { processWatchlistPriceAlerts } from "@/lib/notifications/price-alerts"

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await processWatchlistPriceAlerts()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price alert cron failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
