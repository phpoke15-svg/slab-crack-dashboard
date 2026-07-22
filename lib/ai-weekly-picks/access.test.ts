import { describe, expect, it } from "vitest"
import { portfolioPerformanceForAccess } from "@/lib/ai-weekly-picks/access"

describe("portfolioPerformanceForAccess", () => {
  const sample = {
    bucket_tier: "250" as const,
    total_roi_pct: 12.5,
    win_rate_pct: 68,
    total_gain_loss_usd: 42.5,
    pick_count: 10,
    weeks_tracked: 2,
    budget_spent: 246.5,
    budget_max: 250,
    chart: [
      { week_start_date: "2026-07-07", ai_cumulative_pct: 5, market_cumulative_pct: 3 },
      { week_start_date: "2026-07-14", ai_cumulative_pct: 12.5, market_cumulative_pct: 6 },
    ],
  }

  it("returns full performance for paid access", () => {
    expect(portfolioPerformanceForAccess(sample, true)).toEqual(sample)
  })

  it("strips paid-only metrics for free preview", () => {
    expect(portfolioPerformanceForAccess(sample, false)).toEqual({
      ...sample,
      win_rate_pct: 0,
      total_gain_loss_usd: 0,
      pick_count: 0,
      budget_spent: 0,
      chart: [
        { week_start_date: "2026-07-07", ai_cumulative_pct: 5, market_cumulative_pct: 0 },
        { week_start_date: "2026-07-14", ai_cumulative_pct: 12.5, market_cumulative_pct: 0 },
      ],
    })
  })
})
