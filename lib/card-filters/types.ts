export type CardGrade =
  | "PSA 10"
  | "PSA 9"
  | "PSA 8"
  | "BGS 9.5"
  | "BGS 10"
  | "CGC 10"

export type GradeFilter = CardGrade | "All Grades"

export type MockGradedCard = {
  id: string
  title: string
  price: number
  popCount: number
  grade: CardGrade
}

export type CardMarketFilterState = {
  maxPop: number
  minPrice: number
  maxPrice: number
  grade: GradeFilter
}
