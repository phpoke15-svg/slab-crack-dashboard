import { describe, expect, it } from "vitest"
import { portfolioPerformanceForAccess } from "@/lib/ai-weekly-picks/access"

describe("portfolioPerformanceForAccess", () => {
  const sample = {
    total_roi_pct: 12.5,
    win_rate_pct: 68,
    pick_count: 10,
    weeks_tracked: 2,
    chart: [
      { week_start_date: "2026-07-07", ai_cumulative_pct: 5, market_cumulative_pct: 3 },
      { week_start_date: "2026-07-14", ai_cumulative_pct: 12.5, market_cumulative_pct: 6 },
    ],
  }

  it("returns full performance for paid access", () => {
    expect(portfolioPerformanceForAccess(sample, true)).toEqual(sample)
  })

  it("strips win rate, pick count, and market baseline for free preview", () => {
    expect(portfolioPerformanceForAccess(sample, false)).toEqual({
      total_roi_pct: 12.5,
      win_rate_pct: 0,
      pick_count: 0,
      weeks_tracked: 2,
      chart: [
        { week_start_date: "2026-07-07", ai_cumulative_pct: 5, market_cumulative_pct: 0 },
        { week_start_date: "2026-07-14", ai_cumulative_pct: 12.5, market_cumulative_pct: 0 },
      ],
    })
  })
})
