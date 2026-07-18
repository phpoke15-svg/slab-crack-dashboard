export type DetectedCard = {
  cardName: string
  setName: string
  cardNumber: string
  confidence: number
  notes?: string
}

export type ScanMatchCard = {
  id: string
  cardName: string
  setName: string
  cardNumber: string
  imageUrl: string
  rawPrice: number
  psa9Price?: number
  psa10Price?: number
}

export type ScanMatchResult = {
  ok: true
  detected: DetectedCard
  query: string
  card: ScanMatchCard | null
  matchScore: number
}
