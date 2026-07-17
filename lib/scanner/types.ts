/** Normalized card bounds in 0–1 coordinates relative to the video frame. */
export type CardBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type StabilitySample = {
  blur: number
  motion: number
  stable: boolean
}

export type ScanPipelineResult = {
  ok: true
  detected: {
    cardName: string
    setName: string
    cardNumber: string
    confidence: number
    notes?: string
  }
  query: string
  hit: import("@/lib/card-lookup").CardSearchHit | null
  candidates: import("@/lib/card-lookup").CardSearchHit[]
  card: import("@/lib/slab-data").MockCardEntry | null
  source: "gemini" | "openai" | "visual"
  matchScore: number
  pricingSource: "local" | "live"
  needsLiveRefresh: boolean
  matchMethod: "visual_phash" | "vision" | "ocr"
  timings?: {
    visualMs?: number
    visionMs?: number
    ocrMs?: number
    matchMs?: number
    totalMs: number
  }
}

/** Normalized box from detect API (0–1 fractions). */
export type DetectedCardBounds = {
  x: number
  y: number
  w: number
  h: number
  confidence: number
}

export type BatchScanItemInput = {
  image: string
  phash?: string
  bounds: DetectedCardBounds
}

export type BatchScanCardResult = {
  index: number
  bounds: DetectedCardBounds
  ok: boolean
  error?: string
  result?: ScanPipelineResult
}

export type BatchScanResult = {
  ok: true
  cardCount: number
  cards: BatchScanCardResult[]
  detectSource?: "gemini" | "openai"
  timings: {
    detectMs: number
    identifyMs: number
    totalMs: number
  }
}
