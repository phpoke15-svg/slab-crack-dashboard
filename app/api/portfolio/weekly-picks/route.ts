import { NextResponse } from "next/server"
import { portfolioPerformanceForAccess } from "@/lib/ai-weekly-picks/access"
import {
  computePortfolioPerformanceForTier,
  enrichWeeklyPicksForDisplay,
} from "@/lib/ai-weekly-picks/performance"
import { latestWeekStartDate, loadWeeklyPicks } from "@/lib/ai-weekly-picks/db"
import { parseBucketTier, TIER_BUDGETS } from "@/lib/ai-weekly-picks/tiers"
import { parseWeekStartParam, weekStartDateUtc } from "@/lib/ai-weekly-picks/week"
import { entitlementsForPlan } from "@/lib/billing/plans"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bucketTier = parseBucketTier(searchParams.get("tier")) ?? "100"
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
    const picks = await loadWeeklyPicks(weekStartDate, bucketTier)
    const performance = await computePortfolioPerformanceForTier(
      bucketTier,
      12,
      weekStartDate,
    )
    const gatedPerformance = portfolioPerformanceForAccess(performance, fullAccess)
    const displayPicks = fullAccess ? await enrichWeeklyPicksForDisplay(picks) : []

    return NextResponse.json({
      ok: true,
      access: fullAccess ? "full" : "preview",
      plan: entitlements.plan,
      tier: bucketTier,
      weekStartDate,
      budget: {
        spent: performance.budget_spent,
        min: TIER_BUDGETS[bucketTier].min,
        max: TIER_BUDGETS[bucketTier].max,
        label: TIER_BUDGETS[bucketTier].label,
      },
      picks: displayPicks,
      performance: gatedPerformance,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load portfolio data"
    console.error("[portfolio/weekly-picks]", message)
    return NextResponse.json({ ok: false, error: message, picks: [], performance: null }, { status: 500 })
  }
}
