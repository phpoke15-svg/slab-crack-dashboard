import { NextResponse } from "next/server"
import { portfolioPerformanceForAccess } from "@/lib/ai-weekly-picks/access"
import {
  computePortfolioPerformance,
  enrichWeeklyPicksForDisplay,
} from "@/lib/ai-weekly-picks/performance"
import { latestWeekStartDate, loadWeeklyPicks } from "@/lib/ai-weekly-picks/db"
import { parseWeekStartParam, weekStartDateUtc } from "@/lib/ai-weekly-picks/week"
import { entitlementsForPlan } from "@/lib/billing/plans"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const weekStartDate =
    parseWeekStartParam(searchParams.get("week")) ??
    (await latestWeekStartDate()) ??
    weekStartDateUtc()

  const auth = await requireUser()
  const entitlements = auth.ok
    ? await getEntitlementsForUser(auth.user.id)
    : entitlementsForPlan("free")
  const fullAccess = entitlements.fullAiPortfolio

  try {
    const picks = await loadWeeklyPicks(weekStartDate)
    const performance = await computePortfolioPerformance(12)
    const gatedPerformance = portfolioPerformanceForAccess(performance, fullAccess)
    const displayPicks = fullAccess ? await enrichWeeklyPicksForDisplay(picks) : []

    return NextResponse.json({
      ok: true,
      access: fullAccess ? "full" : "preview",
      plan: entitlements.plan,
      weekStartDate,
      picks: displayPicks,
      performance: gatedPerformance,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load portfolio data"
    console.error("[portfolio/weekly-picks]", message)
    return NextResponse.json({ ok: false, error: message, picks: [], performance: null }, { status: 500 })
  }
}
