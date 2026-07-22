import { gatherWeeklyPickCandidates } from "@/lib/ai-weekly-picks/candidates"
import { countWeeklyTierCoverage, replaceWeeklyPicks } from "@/lib/ai-weekly-picks/db"
import { selectMultiTierWeeklyPicksWithLlm } from "@/lib/ai-weekly-picks/llm"
import { BUCKET_TIERS } from "@/lib/ai-weekly-picks/tiers"
import { weekStartDateUtc } from "@/lib/ai-weekly-picks/week"

export type GenerateWeeklyPicksResult = {
  weekStartDate: string
  candidateCount: number
  pickCount: number
  tiersGenerated: number
  provider: "gemini" | "fallback"
  skipped: boolean
  reason?: string
}

export async function generateWeeklyPicks(input?: {
  weekStartDate?: string
  force?: boolean
}): Promise<GenerateWeeklyPicksResult> {
  const weekStartDate = input?.weekStartDate ?? weekStartDateUtc()

  if (!input?.force) {
    const tierCoverage = await countWeeklyTierCoverage(weekStartDate)
    if (tierCoverage >= BUCKET_TIERS.length) {
      return {
        weekStartDate,
        candidateCount: 0,
        pickCount: 0,
        tiersGenerated: tierCoverage,
        provider: "fallback",
        skipped: true,
        reason: "All budget tiers already exist for this week",
      }
    }
  }

  const candidates = await gatherWeeklyPickCandidates(80)
  const { picks, provider } = await selectMultiTierWeeklyPicksWithLlm(candidates)
  const saved = await replaceWeeklyPicks(weekStartDate, picks)
  const tiersGenerated = new Set(saved.map((pick) => pick.bucket_tier)).size

  return {
    weekStartDate,
    candidateCount: candidates.length,
    pickCount: saved.length,
    tiersGenerated,
    provider,
    skipped: false,
  }
}
