import type { BucketTier } from "@/lib/ai-weekly-picks/tiers"

export type AiWeeklyGradeType = "RAW" | "PSA_9" | "PSA_10"

export type AiWeeklyPickRow = {
  id: string
  week_start_date: string
  bucket_tier: BucketTier
  scrydex_id: string
  grade_type: AiWeeklyGradeType
  pick_price: number
  projected_target_price?: number | null
  ai_rationale: string
  confidence_score: number
  created_at?: string
}

export type AiWeeklyPickCandidate = {
  scrydex_id: string
  catalog_id: string
  card_name: string
  set_name: string
  image_url: string | null
  raw_price: number
  psa10_price: number
  recommended_grade: AiWeeklyGradeType
  pick_price: number
  momentum_30d_pct: number
  supply_velocity: number
  spread_ratio: number
  composite_score: number
}

export type AiWeeklyPickDraft = {
  bucket_tier: BucketTier
  scrydex_id: string
  grade_type: AiWeeklyGradeType
  pick_price: number
  projected_target_price: number
  ai_rationale: string
  confidence_score: number
}

export type AiWeeklyPickDisplay = AiWeeklyPickRow & {
  card_name: string
  set_name: string
  card_number: string | null
  image_url: string | null
  current_price: number | null
  price_target: number | null
  return_pct: number | null
  gain_loss_usd: number | null
}

export type AiPortfolioPerformancePoint = {
  week_start_date: string
  ai_cumulative_pct: number
  market_cumulative_pct: number
}

export type AiPortfolioPerformanceSummary = {
  bucket_tier: BucketTier
  total_roi_pct: number
  win_rate_pct: number
  total_gain_loss_usd: number
  pick_count: number
  weeks_tracked: number
  budget_spent: number
  budget_max: number
  chart: AiPortfolioPerformancePoint[]
}

export type AiPortfolioTierPayload = {
  tier: BucketTier
  picks: AiWeeklyPickDisplay[]
  performance: AiPortfolioPerformanceSummary
}
