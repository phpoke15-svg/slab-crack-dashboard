import { ebaySearchUrl } from "@/lib/ebay-affiliate"
import { slabEbaySearchKeyword } from "@/lib/grading/ebay-search"
import type { SlabGradeRef } from "@/lib/grading/types"
import type { BucketTier } from "@/lib/ai-weekly-picks/tiers"
import type { AiWeeklyGradeType } from "@/lib/ai-weekly-picks/types"

function gradeToSlabRef(grade: AiWeeklyGradeType): SlabGradeRef | null {
  if (grade === "PSA_9") return { company: "PSA", grade: "9" }
  if (grade === "PSA_10") return { company: "PSA", grade: "10" }
  return null
}

export function portfolioPickEbaySearchKeyword(
  cardName: string,
  cardNumber: string,
  setName: string,
  grade: AiWeeklyGradeType,
): string {
  const number = cardNumber.trim()
  const slabRef = gradeToSlabRef(grade)
  if (slabRef) {
    return slabEbaySearchKeyword(cardName, number, slabRef, setName)
  }

  const parts = [cardName, number, setName, "NM"].filter(Boolean)
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

export function portfolioPickEbayAffiliateCampaign(
  scrydexId: string,
  tier: BucketTier,
  grade: AiWeeklyGradeType,
): string {
  const gradeSlug = grade.toLowerCase().replace("_", "")
  return `portfolio-${tier}-${scrydexId}-${gradeSlug}`
}

export function portfolioPickEbayUrl(input: {
  scrydex_id: string
  card_name: string
  card_number?: string | null
  set_name: string
  grade_type: AiWeeklyGradeType
  bucket_tier: BucketTier
}): string {
  return ebaySearchUrl(
    portfolioPickEbaySearchKeyword(
      input.card_name,
      input.card_number ?? "",
      input.set_name,
      input.grade_type,
    ),
    portfolioPickEbayAffiliateCampaign(input.scrydex_id, input.bucket_tier, input.grade_type),
  )
}
