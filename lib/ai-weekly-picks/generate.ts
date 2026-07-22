import { gatherWeeklyPickCandidates } from "@/lib/ai-weekly-picks/candidates"
import { countWeeklyPicks, replaceWeeklyPicks } from "@/lib/ai-weekly-picks/db"
import { selectWeeklyPicksWithLlm } from "@/lib/ai-weekly-picks/llm"
import { weekStartDateUtc } from "@/lib/ai-weekly-picks/week"

export type GenerateWeeklyPicksResult = {
  weekStartDate: string
  candidateCount: number
  pickCount: number
  provider: "openai" | "fallback"
  skipped: boolean
  reason?: string
}

export async function generateWeeklyPicks(input?: {
  weekStartDate?: string
  force?: boolean
}): Promise<GenerateWeeklyPicksResult> {
  const weekStartDate = input?.weekStartDate ?? weekStartDateUtc()

  if (!input?.force) {
    const existing = await countWeeklyPicks(weekStartDate)
    if (existing >= 5) {
      return {
        weekStartDate,
        candidateCount: 0,
        pickCount: existing,
        provider: "fallback",
        skipped: true,
        reason: "Picks already exist for this week",
      }
    }
  }

  const candidates = await gatherWeeklyPickCandidates(15)
  const { picks, provider } = await selectWeeklyPicksWithLlm(candidates)
  const saved = await replaceWeeklyPicks(weekStartDate, picks)

  return {
    weekStartDate,
    candidateCount: candidates.length,
    pickCount: saved.length,
    provider,
    skipped: false,
  }
}
