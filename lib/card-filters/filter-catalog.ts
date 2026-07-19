import type { CardMarketFilterState, SlabPopCard } from "@/lib/card-filters/types"

export function filterGradedCards(
  cards: SlabPopCard[],
  filters: CardMarketFilterState,
): SlabPopCard[] {
  return cards.filter((card) => {
    if (card.popCount > filters.maxPop) return false
    if (card.price < filters.minPrice || card.price > filters.maxPrice) return false
    if (filters.grade !== "All Grades" && card.grade !== filters.grade) return false
    return true
  })
}
