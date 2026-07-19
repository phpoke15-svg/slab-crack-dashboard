import type { CardMarketFilterState, MockGradedCard } from "@/lib/card-filters/types"

export function filterGradedCards(
  cards: MockGradedCard[],
  filters: CardMarketFilterState,
): MockGradedCard[] {
  return cards.filter((card) => {
    if (card.popCount > filters.maxPop) return false
    if (card.price < filters.minPrice || card.price > filters.maxPrice) return false
    if (filters.grade !== "All Grades" && card.grade !== filters.grade) return false
    return true
  })
}
