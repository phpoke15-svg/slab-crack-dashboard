import type { AiWeeklyPickCandidate, AiWeeklyPickDraft, AiWeeklyGradeType } from "@/lib/ai-weekly-picks/types"
import { buildFallbackRationale, priceTargetForGrade } from "@/lib/ai-weekly-picks/candidates"
import {
  selectFallbackMultiTierPicks,
  selectFallbackTierPicks,
  validateTierPicks,
} from "@/lib/ai-weekly-picks/fallback-tiers"
import {
  BUCKET_TIERS,
  type BucketTier,
  TIER_BUDGETS,
} from "@/lib/ai-weekly-picks/tiers"

type LlmTierPick = {
  scrydex_id?: string
  grade_type?: string
  pick_price?: number
  confidence_score?: number
  ai_rationale?: string
  projected_target_price?: number
}

type LlmMultiTierResponse = {
  tiers?: Record<
    string,
    {
      picks?: LlmTierPick[]
    }
  >
}

function normalizeGrade(value: string | undefined): AiWeeklyGradeType | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
  if (normalized === "RAW") return "RAW"
  if (normalized === "PSA_10" || normalized === "PSA10") return "PSA_10"
  if (normalized === "PSA_9" || normalized === "PSA9") return "PSA_9"
  return null
}

function buildPrompt(candidates: AiWeeklyPickCandidate[]): string {
  const payload = candidates.map((candidate) => ({
    scrydex_id: candidate.scrydex_id,
    card_name: candidate.card_name,
    set_name: candidate.set_name,
    raw_price: candidate.raw_price,
    psa10_price: candidate.psa10_price,
    recommended_grade: candidate.recommended_grade,
    momentum_30d_pct: candidate.momentum_30d_pct,
    supply_velocity: candidate.supply_velocity,
    spread_ratio: candidate.spread_ratio,
  }))

  const tierRules = BUCKET_TIERS.map((tier) => {
    const budget = TIER_BUDGETS[tier]
    return `- Tier ${tier}: select multiple cards whose pick_price sum is between $${budget.min.toFixed(2)} and $${budget.max.toFixed(2)}`
  }).join("\n")

  return [
    "You are a TCG portfolio analyst for Collectools.",
    "Build weekly purchase baskets for four budget tiers in one response.",
    tierRules,
    "Each card pick_price must reflect the chosen grade (RAW uses raw_price, PSA_10 uses psa10_price).",
    "Each ai_rationale must be exactly two concise sentences.",
    "Return strict JSON:",
    `{ "tiers": { "100": { "picks": [{ "scrydex_id": string, "grade_type": "RAW"|"PSA_10"|"PSA_9", "pick_price": number, "projected_target_price": number, "confidence_score": number (0-100), "ai_rationale": string }] }, "250": { "picks": [...] }, "500": { "picks": [...] }, "1000": { "picks": [...] } } }`,
    "Use only scrydex_id values from the candidate list. Do not reuse the same scrydex_id across tiers.",
    `Candidates JSON:\n${JSON.stringify(payload, null, 2)}`,
  ].join("\n\n")
}

function parseTierPicks(
  tier: BucketTier,
  entries: LlmTierPick[] | undefined,
  candidates: AiWeeklyPickCandidate[],
): AiWeeklyPickDraft[] {
  const byId = new Map(candidates.map((candidate) => [candidate.scrydex_id, candidate]))
  const picks: AiWeeklyPickDraft[] = []

  for (const entry of entries ?? []) {
    const scrydexId = String(entry.scrydex_id ?? "").trim()
    const candidate = byId.get(scrydexId)
    const grade = normalizeGrade(entry.grade_type) ?? candidate?.recommended_grade
    if (!candidate || !grade) continue

    const defaultPrice =
      grade === "PSA_10" ? candidate.psa10_price : candidate.raw_price
    const pickPrice = Number(entry.pick_price ?? defaultPrice)
    if (pickPrice <= 0) continue

    const projected =
      Number(entry.projected_target_price) ||
      priceTargetForGrade(grade, candidate.raw_price, candidate.psa10_price, candidate.momentum_30d_pct)

    picks.push({
      bucket_tier: tier,
      scrydex_id: scrydexId,
      grade_type: grade,
      pick_price: Number(pickPrice.toFixed(2)),
      projected_target_price: Number(projected.toFixed(2)),
      ai_rationale: String(entry.ai_rationale ?? buildFallbackRationale(candidate)).trim(),
      confidence_score: Math.max(
        0,
        Math.min(100, Number(entry.confidence_score ?? candidate.composite_score * 100) || 70),
      ),
    })
  }

  return validateTierPicks(picks, tier) ? picks : []
}

export async function selectMultiTierWeeklyPicksWithLlm(
  candidates: AiWeeklyPickCandidate[],
): Promise<{ picks: AiWeeklyPickDraft[]; provider: "openai" | "fallback" }> {
  if (candidates.length === 0) {
    return { picks: [], provider: "fallback" }
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return { picks: selectFallbackMultiTierPicks(candidates), provider: "fallback" }
  }

  const model = process.env.AI_WEEKLY_PICKS_MODEL?.trim() || "gpt-4o-mini"

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You rank Pokémon TCG weekly purchase baskets by budget tier. Respond with valid JSON only.",
          },
          { role: "user", content: buildPrompt(candidates) },
        ],
      }),
    })

    const json = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
    } | null

    if (!response.ok) {
      throw new Error(json?.error?.message ?? `OpenAI request failed (${response.status})`)
    }

    const content = json?.choices?.[0]?.message?.content
    if (!content) throw new Error("OpenAI returned empty content")

    const parsed = JSON.parse(content) as LlmMultiTierResponse
    const merged: AiWeeklyPickDraft[] = []
    const usedIds = new Set<string>()

    for (const tier of BUCKET_TIERS) {
      let tierPicks = parseTierPicks(tier, parsed.tiers?.[tier]?.picks, candidates)
      if (tierPicks.length === 0) {
        tierPicks = selectFallbackTierPicks(
          candidates.filter((candidate) => !usedIds.has(candidate.scrydex_id)),
          tier,
        )
      }
      for (const pick of tierPicks) {
        if (usedIds.has(pick.scrydex_id)) continue
        usedIds.add(pick.scrydex_id)
        merged.push(pick)
      }
    }

    if (merged.length === 0) {
      return { picks: selectFallbackMultiTierPicks(candidates), provider: "fallback" }
    }

    return { picks: merged, provider: "openai" }
  } catch (error) {
    console.warn("[ai-weekly-picks/llm] falling back to deterministic tier picks:", error)
    return { picks: selectFallbackMultiTierPicks(candidates), provider: "fallback" }
  }
}
