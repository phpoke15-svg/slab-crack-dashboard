import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { isScrydexConfigured, syncAllExpansions } from "@/lib/scrydex"
import { SLABIT_MAX_SET_AGE_YEARS } from "@/lib/slabit-config"
import type { TcgGame } from "@/lib/scrydex/types"

export const maxDuration = 300
export const dynamic = "force-dynamic"

/** Backfill public.expansions from Scrydex (paginated, stops at maxAgeYears). */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  if (!isScrydexConfigured()) {
    return NextResponse.json({ error: "SCRYDEX_API_KEY / SCRYDEX_TEAM_ID not configured" }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const game = (searchParams.get("game") ?? "pokemon") as TcgGame
  const yearsParam = Number(searchParams.get("years") ?? SLABIT_MAX_SET_AGE_YEARS)
  const pagesParam = Number(searchParams.get("pages") ?? 20)
  const maxAgeYears = Number.isFinite(yearsParam) && yearsParam > 0 ? Math.floor(yearsParam) : SLABIT_MAX_SET_AGE_YEARS
  const maxPages = Number.isFinite(pagesParam) && pagesParam > 0 ? Math.floor(pagesParam) : 20

  if (game !== "pokemon" && game !== "lorcana" && game !== "mtg") {
    return NextResponse.json({ error: "Invalid game — use pokemon, lorcana, or mtg" }, { status: 400 })
  }

  try {
    const result = await syncAllExpansions(game, { maxAgeYears, pageSize: 100, maxPages })
    return NextResponse.json({ ok: true, maxAgeYears, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Expansion sync failed"
    console.error("[cron/sync-expansions]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
