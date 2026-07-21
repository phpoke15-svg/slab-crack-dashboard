import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { isScrydexConfigured } from "@/lib/scrydex/constants"
import { repairScrydexCatalogPrices } from "@/lib/scrydex/repair-stale-prices"

export const maxDuration = 300
export const dynamic = "force-dynamic"

function parseIdsParam(value: string | null): string[] | undefined {
  if (!value?.trim()) return undefined
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  if (!isScrydexConfigured()) {
    return NextResponse.json({ error: "SCRYDEX_API_KEY / SCRYDEX_TEAM_ID not configured" }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const ids = parseIdsParam(searchParams.get("ids"))
  const includePromos = searchParams.get("promos") !== "0"
  const includeHistory = searchParams.get("includeHistory") === "1"
  const maxCards = Number(searchParams.get("maxCards") ?? 0)

  try {
    const result = await repairScrydexCatalogPrices({
      ids,
      includePromos,
      includeHistory,
      maxCards: Number.isFinite(maxCards) && maxCards > 0 ? maxCards : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrydex price repair failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
