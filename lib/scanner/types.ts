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
  matchMethod: "visual_phash" | "vision"
  timings?: {
    visualMs?: number
    visionMs?: number
    matchMs?: number
    totalMs: number
  }
}
