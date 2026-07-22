import { formatSlabLabel, type SlabGradeRef } from "@/lib/grading/types"

/** Build an eBay keyword for a graded slab search. */
export function slabEbaySearchKeyword(
  cardName: string,
  cardNumber: string,
  ref: SlabGradeRef,
  setName?: string,
): string {
  const base = `${cardName} ${cardNumber}`.trim()
  return `${base} ${formatSlabLabel(ref)}`.replace(/\s+/g, " ").trim()
}

/** Generic graded listing search (any slab grade, not a specific PSA 10). */
export function slabEbayGradedSearchKeyword(
  cardName: string,
  cardNumber: string,
  setName?: string,
): string {
  const parts = [cardName, cardNumber, setName, "PSA graded"].filter(Boolean)
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

export function slabEbayGradedAffiliateCampaign(cardId: string, prefix: string): string {
  return `${prefix}-${cardId}-graded`
}

export function slabEbayAffiliateCampaign(cardId: string, ref: SlabGradeRef, prefix: string): string {
  const slug = `${ref.company.toLowerCase()}${ref.grade.replace(/[^\d.a-z]/gi, "")}`
  return `${prefix}-${cardId}-${slug}`
}
