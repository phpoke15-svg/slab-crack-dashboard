import type { AiPortfolioPerformanceSummary } from "@/lib/ai-weekly-picks/types"

export function portfolioPerformanceForAccess(
  performance: AiPortfolioPerformanceSummary,
  fullAccess: boolean,
): AiPortfolioPerformanceSummary {
  if (fullAccess) return performance

  return {
    ...performance,
    win_rate_pct: 0,
    total_gain_loss_usd: 0,
    pick_count: 0,
    budget_spent: 0,
    chart: performance.chart.map((point) => ({
      week_start_date: point.week_start_date,
      ai_cumulative_pct: point.ai_cumulative_pct,
      market_cumulative_pct: 0,
    })),
  }
}
