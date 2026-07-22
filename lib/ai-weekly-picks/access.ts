import type { AiPortfolioPerformanceSummary } from "@/lib/ai-weekly-picks/types"

export function portfolioPerformanceForAccess(
  performance: AiPortfolioPerformanceSummary,
  fullAccess: boolean,
): AiPortfolioPerformanceSummary {
  if (fullAccess) return performance

  return {
    total_roi_pct: performance.total_roi_pct,
    win_rate_pct: 0,
    pick_count: 0,
    weeks_tracked: performance.weeks_tracked,
    chart: performance.chart.map((point) => ({
      week_start_date: point.week_start_date,
      ai_cumulative_pct: point.ai_cumulative_pct,
      market_cumulative_pct: 0,
    })),
  }
}
