import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { syncBinderCardPrices } from "@/lib/sync-binder-prices"

export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await syncBinderCardPrices()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Binder price sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
