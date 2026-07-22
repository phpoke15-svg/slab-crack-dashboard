import { NextResponse } from "next/server"
import {
  computePortfolioPerformance,
  enrichWeeklyPicksForDisplay,
} from "@/lib/ai-weekly-picks/performance"
import { latestWeekStartDate, loadWeeklyPicks } from "@/lib/ai-weekly-picks/db"
import { parseWeekStartParam, weekStartDateUtc } from "@/lib/ai-weekly-picks/week"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const weekStartDate =
    parseWeekStartParam(searchParams.get("week")) ??
    (await latestWeekStartDate()) ??
    weekStartDateUtc()

  try {
    const picks = await loadWeeklyPicks(weekStartDate)
    const [displayPicks, performance] = await Promise.all([
      enrichWeeklyPicksForDisplay(picks),
      computePortfolioPerformance(12),
    ])

    return NextResponse.json({
      ok: true,
      weekStartDate,
      picks: displayPicks,
      performance,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load portfolio data"
    console.error("[portfolio/weekly-picks]", message)
    return NextResponse.json({ ok: false, error: message, picks: [], performance: null }, { status: 500 })
  }
}
