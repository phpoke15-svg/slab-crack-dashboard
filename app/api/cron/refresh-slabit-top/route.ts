import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { refreshSlabItTopCache } from "@/lib/db/top-ranked-cards"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"
import { SLABIT_MAX_SET_AGE_YEARS } from "@/lib/slabit-config"

export const maxDuration = 300
export const dynamic = "force-dynamic"

/** Rebuild SlabIt top-100 from live prices — sets released within the past 5 years. */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const cache = await refreshSlabItTopCache(TOP_CARDS_LIMIT)
    return NextResponse.json({
      ok: true,
      count: cache.cards.length,
      syncedAt: cache.syncedAt,
      maxSetAgeYears: SLABIT_MAX_SET_AGE_YEARS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "SlabIt refresh failed"
    console.error("[cron/refresh-slabit-top]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
