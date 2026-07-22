import type { AiWeeklyPickCandidate, AiWeeklyPickDraft, AiWeeklyGradeType } from "@/lib/ai-weekly-picks/types"
import { buildFallbackRationale, priceTargetForGrade } from "@/lib/ai-weekly-picks/candidates"
import {
  BUCKET_TIERS,
  type BucketTier,
  priceInCandidateRange,
  TIER_BUDGETS,
  tierBudgetInRange,
  tierBudgetSpent,
} from "@/lib/ai-weekly-picks/tiers"

type GradeOption = {
  grade: AiWeeklyGradeType
  price: number
}

function gradeOptionsForCandidate(candidate: AiWeeklyPickCandidate): GradeOption[] {
  const options: GradeOption[] = []
  if (priceInCandidateRange(candidate.raw_price)) {
    options.push({ grade: "RAW", price: candidate.raw_price })
  }
  if (priceInCandidateRange(candidate.psa10_price)) {
    options.push({ grade: "PSA_10", price: candidate.psa10_price })
  }
  return options.sort((a, b) => a.price - b.price)
}

export function selectFallbackTierPicks(
  candidates: AiWeeklyPickCandidate[],
  tier: BucketTier,
): AiWeeklyPickDraft[] {
  const { min, max } = TIER_BUDGETS[tier]
  const picks: AiWeeklyPickDraft[] = []
  const used = new Set<string>()
  let spent = 0

  const pool = [...candidates].sort((a, b) => b.composite_score - a.composite_score)

  while (spent < min) {
    let best: { candidate: AiWeeklyPickCandidate; option: GradeOption } | null = null
    let bestScore = Number.NEGATIVE_INFINITY

    for (const candidate of pool) {
      if (used.has(candidate.scrydex_id)) continue

      for (const option of gradeOptionsForCandidate(candidate)) {
        const nextSpent = spent + option.price
        if (option.price <= 0 || nextSpent > max) continue

        let score = candidate.composite_score * 100
        if (nextSpent >= min) score += 100
        if (nextSpent >= min && nextSpent <= max) score += 40

        const remainingHeadroom = max - nextSpent
        const stillNeed = min - spent
        if (stillNeed > option.price) {
          // Need multiple cards — favor cheaper picks that preserve headroom.
          score += remainingHeadroom / 10
          score -= option.price / 20
        } else {
          // Close to the target band — favor prices that land inside [min, max].
          score += option.price / 10
          score -= Math.abs(min - nextSpent)
        }

        if (score > bestScore) {
          bestScore = score
          best = { candidate, option }
        }
      }
    }

    if (!best) break

    const target = priceTargetForGrade(
      best.option.grade,
      best.candidate.raw_price,
      best.candidate.psa10_price,
      best.candidate.momentum_30d_pct,
    )

    picks.push({
      bucket_tier: tier,
      scrydex_id: best.candidate.scrydex_id,
      grade_type: best.option.grade,
      pick_price: best.option.price,
      projected_target_price: target,
      ai_rationale: buildFallbackRationale({
        ...best.candidate,
        recommended_grade: best.option.grade,
        pick_price: best.option.price,
      }),
      confidence_score: Math.max(
        55,
        Math.min(90, Math.round(best.candidate.composite_score * 100)),
      ),
    })
    used.add(best.candidate.scrydex_id)
    spent += best.option.price
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
