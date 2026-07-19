export type CardGrade =
  | "PSA 10"
  | "PSA 9"
  | "PSA 8"
  | "BGS 9.5"
  | "BGS 10"
  | "CGC 10"

export type GradeFilter = CardGrade | "All Grades"

export type SlabPopCard = {
  id: string
  cardId: string
  title: string
  price: number
  popCount: number
  grade: CardGrade
  image: string
  setName?: string
  cardNumber?: string
  /** sold_comps = SlabCrack eBay sample size; market_activity = price_history proxy */
  popSource?: "sold_comps" | "market_activity" | "demo"
}

/** @deprecated Use SlabPopCard */
export type MockGradedCard = SlabPopCard

export type CardMarketFilterState = {
  maxPop: number
  minPrice: number
  maxPrice: number
  grade: GradeFilter
}
