import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { loadDailyHistoryRows } from "@/lib/scrydex/db"
import { toCatalogId } from "@/lib/scrydex/constants"
import type { AiWeeklyPickCandidate, AiWeeklyGradeType } from "@/lib/ai-weekly-picks/types"
import {
  CANDIDATE_MAX_PRICE,
  CANDIDATE_MIN_PRICE,
  cardHasPickablePrice,
  priceInCandidateRange,
} from "@/lib/ai-weekly-picks/tiers"
import {
  computeMomentum30dPct,
  computeSpreadRatio,
  computeSupplyVelocity,
  priceTargetForGrade,
  recommendGradeType,
} from "@/lib/ai-weekly-picks/signals"

type PricedCardRow = {
  id: string
  name: string
  set_name: string
  image_url: string | null
  scrydex_id: string | null
  current_price_raw: number | null
  current_price_psa10: number | null
  price_updated_at: string | null
}

const MAX_CANDIDATE_SCAN = 1200
const HISTORY_BATCH = 120

function pickPriceForGrade(grade: AiWeeklyGradeType, raw: number, psa10: number): number {
  if (grade === "PSA_10") return psa10
  return raw
}

function resolvePickGrade(
  raw: number,
  psa10: number,
  recommended: AiWeeklyGradeType,
): { grade: AiWeeklyGradeType; pickPrice: number } | null {
  const recommendedPrice = pickPriceForGrade(recommended, raw, psa10)
  if (priceInCandidateRange(recommendedPrice)) {
    return { grade: recommended, pickPrice: recommendedPrice }
  }
  if (priceInCandidateRange(raw)) {
    return { grade: "RAW", pickPrice: raw }
  }
  if (priceInCandidateRange(psa10)) {
    return { grade: "PSA_10", pickPrice: psa10 }
  }
  return null
}

function compositeScore(input: {
  momentum: number
  supplyVelocity: number
  spreadRatio: number
  pickPrice: number
}): number {
  const momentumNorm = Math.max(0, Math.min(1, (input.momentum + 10) / 40))
  const velocityNorm = Math.max(0, Math.min(1, input.supplyVelocity / 20))
  const spreadNorm = Math.max(0, Math.min(1, (input.spreadRatio - 1) / 1.5))
  const valueNorm = Math.max(0, 1 - input.pickPrice / CANDIDATE_MAX_PRICE)
  return momentumNorm * 0.35 + spreadNorm * 0.35 + velocityNorm * 0.2 + valueNorm * 0.1
}

function candidatePriceOrFilter(): string {
  return [
    `and(current_price_raw.gte.${CANDIDATE_MIN_PRICE},current_price_raw.lte.${CANDIDATE_MAX_PRICE})`,
    `and(current_price_psa10.gte.${CANDIDATE_MIN_PRICE},current_price_psa10.lte.${CANDIDATE_MAX_PRICE})`,
  ].join(",")
}

async function fetchPricedCardsInRange(): Promise<PricedCardRow[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = createAdminClient()
  const rows: PricedCardRow[] = []

  for (let page = 0; page < 12; page++) {
    const from = page * 500
    const to = from + 499
    const { data, error } = await supabase
      .from("cards")
      .select(
        "id, name, set_name, image_url, scrydex_id, current_price_raw, current_price_psa10, price_updated_at",
      )
      .not("scrydex_id", "is", null)
      .or(candidatePriceOrFilter())
      .order("price_updated_at", { ascending: false, nullsFirst: false })
      .range(from, to)

    if (error?.code === "42P01" || error?.code === "42703") return []
    if (error) throw error

    const batch = (data ?? []) as PricedCardRow[]
    rows.push(...batch)
    if (batch.length < 500) break
  }

  return rows.slice(0, MAX_CANDIDATE_SCAN)
}

export async function gatherWeeklyPickCandidates(limit = 80): Promise<AiWeeklyPickCandidate[]> {
  const cards = await fetchPricedCardsInRange()
  const preScored = cards
    .map((card) => {
      const scrydexId = String(card.scrydex_id ?? "").trim()
      const raw = Number(card.current_price_raw ?? 0)
      const psa10 = Number(card.current_price_psa10 ?? 0)
      if (!scrydexId || !cardHasPickablePrice(raw, psa10)) return null

      const spreadRatio = computeSpreadRatio(raw, psa10)
      const preliminary = spreadRatio * 0.6 + (psa10 - raw) / Math.max(raw, 1)
      return { card, scrydexId, raw, psa10, spreadRatio, preliminary }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => b.preliminary - a.preliminary)
    .slice(0, HISTORY_BATCH)

  const candidates: AiWeeklyPickCandidate[] = []

  for (const entry of preScored) {
    const catalogId = toCatalogId("pokemon", entry.scrydexId)
    const history = (await loadDailyHistoryRows(catalogId, 45)) as Array<Record<string, unknown>>

    const momentumRaw = computeMomentum30dPct(history, "RAW")
    const momentumPsa10 = computeMomentum30dPct(history, "PSA_10")
    const supplyVelocity = computeSupplyVelocity(history)
    const spreadRatio = computeSpreadRatio(entry.raw, entry.psa10)
    const recommendedGrade = recommendGradeType(
      entry.raw,
      entry.psa10,
      momentumRaw,
      momentumPsa10,
      spreadRatio,
    )
    const resolved = resolvePickGrade(entry.raw, entry.psa10, recommendedGrade)
    if (!resolved) continue

    const momentum = resolved.grade === "PSA_10" ? momentumPsa10 : momentumRaw
    const composite = compositeScore({
      momentum,
      supplyVelocity,
      spreadRatio,
      pickPrice: resolved.pickPrice,
    })

    candidates.push({
      scrydex_id: entry.scrydexId,
      catalog_id: catalogId,
      card_name: entry.card.name,
      set_name: entry.card.set_name,
      image_url: entry.card.image_url,
      raw_price: entry.raw,
      psa10_price: entry.psa10,
      recommended_grade: resolved.grade,
      pick_price: resolved.pickPrice,
      momentum_30d_pct: Number(momentum.toFixed(2)),
      supply_velocity: supplyVelocity,
      spread_ratio: Number(spreadRatio.toFixed(3)),
      composite_score: Number(composite.toFixed(4)),
    })
  }

  return candidates.sort((a, b) => b.composite_score - a.composite_score).slice(0, limit)
}

export function buildFallbackRationale(candidate: AiWeeklyPickCandidate): string {
  const target = priceTargetForGrade(
    candidate.recommended_grade,
    candidate.raw_price,
    candidate.psa10_price,
    candidate.momentum_30d_pct,
  )
  return `Scrydex shows ${candidate.momentum_30d_pct.toFixed(1)}% 30-day momentum with a ${candidate.spread_ratio.toFixed(2)}× PSA 10 spread and active price updates (${candidate.supply_velocity} recent snapshots). We like ${candidate.recommended_grade} near $${candidate.pick_price.toFixed(2)} with a target around $${target.toFixed(2)}.`
}

export { priceTargetForGrade }
