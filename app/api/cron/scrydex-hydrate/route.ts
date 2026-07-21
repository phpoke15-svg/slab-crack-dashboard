import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { hydrateExpansionPage, isScrydexConfigured, syncRecentExpansions } from "@/lib/scrydex"
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

  try {
    if (gameParam && expansionId) {
      const result = await hydrateExpansionPage({ game: gameParam, expansionId, includePrices })
      return NextResponse.json(result)
    }

    const results = []
    for (const game of gameParam ? [gameParam] : GAMES) {
      const delta = await syncRecentExpansions(game, 5)
      const firstExpansion = delta.ids[0]
      if (!firstExpansion) {
        results.push({ game, delta, hydrate: null })
        continue
      }
      const hydrate = await hydrateExpansionPage({
        game,
        expansionId: firstExpansion,
        includePrices,
      })
      results.push({ game, delta, hydrate })
    }

    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrydex hydration failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
