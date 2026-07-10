import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { syncWalmartRestocks } from "@/lib/restocks/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Poll Walmart Affiliate for watched SKUs. PC stock arrives via /api/restocks/report. */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await syncWalmartRestocks()
    return NextResponse.json({ ok: true, ...result, time: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    )
  }
}
