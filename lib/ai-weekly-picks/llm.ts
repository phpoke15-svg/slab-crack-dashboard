import type { AiWeeklyPickCandidate, AiWeeklyPickDraft } from "@/lib/ai-weekly-picks/types"
import { buildFallbackRationale } from "@/lib/ai-weekly-picks/candidates"

type LlmPickResponse = {
  picks?: Array<{
    scrydex_id?: string
    grade_type?: string
    confidence_score?: number
    ai_rationale?: string
  }>
}

function normalizeGrade(value: string | undefined): "RAW" | "PSA_10" | "PSA_9" | null {
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
    recommended_grade: candidate.recommended_grade,
    pick_price: candidate.pick_price,
    raw_price: candidate.raw_price,
    psa10_price: candidate.psa10_price,
    momentum_30d_pct: candidate.momentum_30d_pct,
    supply_velocity: candidate.supply_velocity,
    spread_ratio: candidate.spread_ratio,
  }))

  return [
    "You are a TCG portfolio analyst for Collectools.",
    "Select exactly 5 purchase opportunities from the candidate cards.",
    "Prefer cards with strong 30-day momentum, healthy PSA 10 vs raw spreads, and active market velocity.",
    "Each rationale must be exactly two concise sentences.",
    "Return strict JSON: { \"picks\": [{ \"scrydex_id\": string, \"grade_type\": \"RAW\"|\"PSA_10\"|\"PSA_9\", \"confidence_score\": number (0-100), \"ai_rationale\": string }] }",
    "Use only scrydex_id values from the candidate list.",
    `Candidates JSON:\n${JSON.stringify(payload, null, 2)}`,
  ].join("\n\n")
}

function fallbackPicks(candidates: AiWeeklyPickCandidate[]): AiWeeklyPickDraft[] {
  return candidates.slice(0, 5).map((candidate, index) => ({
    scrydex_id: candidate.scrydex_id,
    grade_type: candidate.recommended_grade,
    pick_price: candidate.pick_price,
    ai_rationale: buildFallbackRationale(candidate),
    confidence_score: Math.max(55, Math.min(92, 88 - index * 4)),
  }))
}

export async function selectWeeklyPicksWithLlm(
  candidates: AiWeeklyPickCandidate[],
): Promise<{ picks: AiWeeklyPickDraft[]; provider: "openai" | "fallback" }> {
  if (candidates.length === 0) {
    return { picks: [], provider: "fallback" }
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return { picks: fallbackPicks(candidates), provider: "fallback" }
  }

  const model = process.env.AI_WEEKLY_PICKS_MODEL?.trim() || process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini"

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
              "You rank Pokémon TCG weekly purchase opportunities. Respond with valid JSON only.",
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

    const parsed = JSON.parse(content) as LlmPickResponse
    const byId = new Map(candidates.map((candidate) => [candidate.scrydex_id, candidate]))
    const picks: AiWeeklyPickDraft[] = []

    for (const entry of parsed.picks ?? []) {
      const scrydexId = String(entry.scrydex_id ?? "").trim()
      const candidate = byId.get(scrydexId)
      const grade = normalizeGrade(entry.grade_type) ?? candidate?.recommended_grade
      if (!candidate || !grade) continue

      const pickPrice =
        grade === "PSA_10"
          ? candidate.psa10_price
          : grade === "PSA_9"
            ? candidate.raw_price
            : candidate.raw_price

      picks.push({
        scrydex_id: scrydexId,
        grade_type: grade,
        pick_price: pickPrice,
        ai_rationale: String(entry.ai_rationale ?? buildFallbackRationale(candidate)).trim(),
        confidence_score: Math.max(
          0,
          Math.min(100, Number(entry.confidence_score ?? candidate.composite_score * 100) || 70),
        ),
      })
      if (picks.length >= 5) break
    }

    if (picks.length < 5) {
      const used = new Set(picks.map((pick) => pick.scrydex_id))
      for (const candidate of candidates) {
        if (used.has(candidate.scrydex_id)) continue
        picks.push({
          scrydex_id: candidate.scrydex_id,
          grade_type: candidate.recommended_grade,
          pick_price: candidate.pick_price,
          ai_rationale: buildFallbackRationale(candidate),
          confidence_score: 72,
        })
        used.add(candidate.scrydex_id)
        if (picks.length >= 5) break
      }
    }

    return { picks: picks.slice(0, 5), provider: "openai" }
  } catch (error) {
    console.warn("[ai-weekly-picks/llm] falling back to deterministic picks:", error)
    return { picks: fallbackPicks(candidates), provider: "fallback" }
  }
}
