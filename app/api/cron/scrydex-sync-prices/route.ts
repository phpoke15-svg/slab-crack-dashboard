import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { isScrydexConfigured, probeScrydexSync, syncScrydexPrices } from "@/lib/scrydex"

export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  if (searchParams.get("probe") === "1") {
    const probe = await probeScrydexSync()
    return NextResponse.json(probe, { status: probe.ok ? 200 : 503 })
  }

  if (!isScrydexConfigured()) {
    return NextResponse.json({ error: "SCRYDEX_API_KEY / SCRYDEX_TEAM_ID not configured" }, { status: 503 })
  }

  const maxCards = Number(searchParams.get("maxCards") ?? 0)
  const includeHistory = searchParams.get("includeHistory") === "1"

  try {
    const result = await syncScrydexPrices({
      maxCards: Number.isFinite(maxCards) && maxCards > 0 ? maxCards : undefined,
      includeHistory,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrydex price sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
