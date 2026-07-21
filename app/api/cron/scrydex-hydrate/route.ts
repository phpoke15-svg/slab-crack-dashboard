import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import {
  hydrateExpansionPage,
  isScrydexConfigured,
  pickNextHydrationJob,
  scrydexOnDemandOnly,
  syncRecentExpansions,
} from "@/lib/scrydex"
import type { TcgGame } from "@/lib/scrydex/types"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const GAMES: TcgGame[] = ["pokemon", "lorcana", "mtg"]

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  if (!isScrydexConfigured()) {
    return NextResponse.json({ error: "SCRYDEX_API_KEY / SCRYDEX_TEAM_ID not configured" }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const gameParam = searchParams.get("game") as TcgGame | null
  const expansionId = searchParams.get("expansionId")?.trim()
  const includePrices = searchParams.get("includePrices") === "1"
  const games = gameParam ? [gameParam] : GAMES

  try {
    if (scrydexOnDemandOnly()) {
      return NextResponse.json({
        skipped: true,
        mode: "on-demand",
        message: "Bulk hydration disabled — cards backfill on search/view instead.",
      })
    }

    if (gameParam && expansionId) {
      const result = await hydrateExpansionPage({ game: gameParam, expansionId, includePrices })
      return NextResponse.json(result)
    }

    const results = []
    for (const game of games) {
      const delta = await syncRecentExpansions(game, 5)
      const nextJob = await pickNextHydrationJob(game)
      if (!nextJob) {
        results.push({ game, delta, hydrate: null, message: "No pending hydration jobs" })
        continue
      }

      const hydrate = await hydrateExpansionPage({
        game: nextJob.game,
        expansionId: nextJob.expansionId,
        includePrices,
      })

      results.push({
        game,
        delta,
        hydrate,
        job: {
          expansionId: nextJob.expansionId,
          previousStatus: nextJob.status,
          complete: hydrate.complete,
        },
      })
    }

    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrydex hydration failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
