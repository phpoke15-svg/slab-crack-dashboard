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
import { isGeminiModelUnavailable } from "@/lib/slabcrack/gemini-models"
import {
  extractGeminiAnswerText,
  extractJsonObject,
  thinkingConfigForModel,
  type GeminiGenerateResponse,
} from "@/lib/slabcrack/identify-parse"

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

export type WeeklyPicksLlmProvider = "gemini" | "fallback"

const SYSTEM_PROMPT =
  "You rank Pokémon TCG weekly purchase baskets by budget tier. Respond with valid JSON only."

function weeklyPicksGeminiModels(): string[] {
  const preferred = (process.env.AI_WEEKLY_PICKS_MODEL || "").trim()
  const defaults = ["gemini-2.0-flash", "gemini-3.5-flash", "gemini-flash-latest"]
  return [preferred, ...defaults].filter(
    (model, index, models): model is string => Boolean(model) && models.indexOf(model) === index,
  )
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

export function mergeMultiTierLlmResponse(
  parsed: LlmMultiTierResponse,
  candidates: AiWeeklyPickCandidate[],
): AiWeeklyPickDraft[] {
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

  return merged
}

async function callGeminiWeeklyPicks(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const thinking = thinkingConfigForModel(model)
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
    temperature: 0.2,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig,
    }),
  })

  const bodyText = await response.text()
  if (!response.ok) {
    const err = new Error(
      `Gemini ${model} HTTP ${response.status}: ${bodyText.slice(0, 280)}`,
    ) as Error & { status?: number; body?: string }
    err.status = response.status
    err.body = bodyText
    throw err
  }

  const json = JSON.parse(bodyText) as GeminiGenerateResponse
  const { text, blockReason } = extractGeminiAnswerText(json)
  if (blockReason) {
    throw new Error(`Gemini blocked the weekly picks request (${blockReason}) on ${model}.`)
  }
  if (!text) {
    throw new Error(`Gemini returned empty weekly picks content from ${model}.`)
  }

  return text
}

export async function selectMultiTierWeeklyPicksWithLlm(
  candidates: AiWeeklyPickCandidate[],
): Promise<{ picks: AiWeeklyPickDraft[]; provider: WeeklyPicksLlmProvider }> {
  if (candidates.length === 0) {
    return { picks: [], provider: "fallback" }
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return { picks: selectFallbackMultiTierPicks(candidates), provider: "fallback" }
  }

  const prompt = buildPrompt(candidates)
  const models = weeklyPicksGeminiModels()
  let lastError = "Gemini weekly picks failed."

  for (const model of models) {
    try {
      const content = await callGeminiWeeklyPicks(apiKey, model, prompt)
      const parsed = JSON.parse(extractJsonObject(content)) as LlmMultiTierResponse
      const merged = mergeMultiTierLlmResponse(parsed, candidates)

      if (merged.length === 0) {
        lastError = `Gemini ${model} returned no valid tier baskets.`
        continue
      }

      return { picks: merged, provider: "gemini" }
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
      const status = (error as Error & { status?: number }).status
      const body = (error as Error & { body?: string }).body ?? ""
      if (status && isGeminiModelUnavailable(status, body)) {
        continue
      }
      if (status === 429 || status === 503) {
        break
      }
    }
  }

  console.warn("[ai-weekly-picks/llm] falling back to deterministic tier picks:", lastError)
  return { picks: selectFallbackMultiTierPicks(candidates), provider: "fallback" }
}
