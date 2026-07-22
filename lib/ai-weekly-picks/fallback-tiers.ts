import type { AiWeeklyPickCandidate, AiWeeklyPickDraft, AiWeeklyGradeType } from "@/lib/ai-weekly-picks/types"
import { buildFallbackRationale, priceTargetForGrade } from "@/lib/ai-weekly-picks/candidates"
import {
  BUCKET_TIERS,
  type BucketTier,
  TIER_BUDGETS,
  tierBudgetInRange,
  tierBudgetSpent,
} from "@/lib/ai-weekly-picks/tiers"

function pickPriceForGrade(
  candidate: AiWeeklyPickCandidate,
  grade: AiWeeklyGradeType,
): number {
  if (grade === "PSA_10") return candidate.psa10_price
  return candidate.raw_price
}

export function selectFallbackTierPicks(
  candidates: AiWeeklyPickCandidate[],
  tier: BucketTier,
): AiWeeklyPickDraft[] {
  const { min, max } = TIER_BUDGETS[tier]
  const picks: AiWeeklyPickDraft[] = []
  const used = new Set<string>()
  let spent = 0

  for (const candidate of candidates) {
    if (used.has(candidate.scrydex_id)) continue
    const grade = candidate.recommended_grade
    const price = pickPriceForGrade(candidate, grade)
    if (price <= 0 || spent + price > max) continue

    const target = priceTargetForGrade(
      grade,
      candidate.raw_price,
      candidate.psa10_price,
      candidate.momentum_30d_pct,
    )

    picks.push({
      bucket_tier: tier,
      scrydex_id: candidate.scrydex_id,
      grade_type: grade,
      pick_price: price,
      projected_target_price: target,
      ai_rationale: buildFallbackRationale(candidate),
      confidence_score: Math.max(55, Math.min(90, Math.round(candidate.composite_score * 100))),
    })
    used.add(candidate.scrydex_id)
    spent += price
    if (spent >= min) break
  }

  if (!tierBudgetInRange(spent, tier)) {
    return []
  }

  return picks
}

export function selectFallbackMultiTierPicks(
  candidates: AiWeeklyPickCandidate[],
): AiWeeklyPickDraft[] {
  const all: AiWeeklyPickDraft[] = []
  const usedGlobally = new Set<string>()

  for (const tier of BUCKET_TIERS) {
    const pool = candidates.filter((candidate) => !usedGlobally.has(candidate.scrydex_id))
    const tierPicks = selectFallbackTierPicks(pool, tier)
    for (const pick of tierPicks) {
      usedGlobally.add(pick.scrydex_id)
      all.push(pick)
    }
  }

  return all
}

export function validateTierPicks(picks: AiWeeklyPickDraft[], tier: BucketTier): boolean {
  const tierPicks = picks.filter((pick) => pick.bucket_tier === tier)
  if (tierPicks.length === 0) return false
  const spent = tierBudgetSpent(tierPicks.map((pick) => pick.pick_price))
  return tierBudgetInRange(spent, tier)
}

export function summarizeTierBudget(picks: AiWeeklyPickDraft[], tier: BucketTier) {
  const tierPicks = picks.filter((pick) => pick.bucket_tier === tier)
  const spent = tierBudgetSpent(tierPicks.map((pick) => pick.pick_price))
  return {
    spent,
    min: TIER_BUDGETS[tier].min,
    max: TIER_BUDGETS[tier].max,
    pickCount: tierPicks.length,
  }
}
