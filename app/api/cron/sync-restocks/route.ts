import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { syncWalmartRestocks } from "@/lib/restocks/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * 1) Auto-discover sealed Pokémon TCG SKUs via Walmart Affiliate search
 * 2) Poll stock for all active Walmart watchlist items
 *
 * Pokémon Center live drops stay on PokeWatch — not this cron.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const skipDiscover = url.searchParams.get("discover") === "0"

  try {
    const result = await syncWalmartRestocks({ discover: !skipDiscover })
    return NextResponse.json({ ok: true, ...result, time: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    )
  }
}
