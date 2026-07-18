import "server-only"
import {
  identifyCardVision,
  matchDetectedCard,
  type DetectedCard,
} from "@/lib/slabcrack/identify-card"
import { shouldTrustOcrDetected } from "@/lib/scanner/ocr-parse"
import { identifyResultToScanPipeline } from "@/lib/scanner/scan-result"
import { matchCardByPhash, priceVisualMatch } from "@/lib/scanner/visual-match"
import type { ScanPipelineResult } from "@/lib/scanner/types"
import { minAutoMatchScore } from "@/lib/slabcrack/identify-parse"

export type ScanCardInput = {
  /** Cropped card JPEG data URL */
  image: string
  /** 16-char hex dHash from client */
  phash?: string
  /** Client OCR output — skips vision when present */
  detected?: Partial<DetectedCard>
  /** Skip visual index and go straight to vision */
  forceVision?: boolean
}

export async function scanCardPipeline(input: ScanCardInput): Promise<ScanPipelineResult> {
  const started = Date.now()
  let visualMs = 0
  let visionMs = 0
  let matchMs = 0
  let ocrMs = 0

  if (shouldTrustOcrDetected(input.detected as DetectedCard | undefined)) {
    const matchStart = Date.now()
    const matched = await matchDetectedCard(input.detected!, "gemini")
    matchMs = Date.now() - matchStart

    const ocrTrusted =
      matched.hit && matched.matchScore >= minAutoMatchScore(matched.detected)

    if (ocrTrusted) {
      return identifyResultToScanPipeline(matched, "ocr", {
        ocrMs,
        matchMs,
        totalMs: Date.now() - started,
      })
    }
  }

  if (!input.forceVision && input.phash?.trim()) {
    const visualStart = Date.now()
    const visual = await matchCardByPhash(input.phash.trim())
    visualMs = Date.now() - visualStart

    if (visual && visual.confidence >= 72) {
      const matchStart = Date.now()
      const priced = await priceVisualMatch(visual)
      matchMs = Date.now() - matchStart

      if (priced.card) {
        return {
          ok: true,
          detected: priced.detected,
          query: `${priced.detected.cardName} ${priced.detected.cardNumber}`.trim(),
          hit: priced.hit,
          candidates: priced.candidates,
          card: priced.card,
          source: "visual",
          matchScore: priced.matchScore,
          pricingSource: "local",
          needsLiveRefresh: priced.needsLiveRefresh,
          matchMethod: "visual_phash",
          timings: { visualMs, matchMs, totalMs: Date.now() - started },
        }
      }
    }
  }

  const visionStart = Date.now()
  const vision = await identifyCardVision(input.image)
  visionMs = Date.now() - visionStart

  const matchStart = Date.now()
  const matched = await matchDetectedCard(vision.detected, vision.source)
  matchMs = Date.now() - matchStart

  return {
    ok: true,
    detected: matched.detected,
    query: matched.query,
    hit: matched.hit,
    candidates: matched.candidates,
    card: matched.card,
    source: vision.source,
    matchScore: matched.matchScore,
    pricingSource: matched.pricingSource,
    needsLiveRefresh: matched.needsLiveRefresh,
    matchMethod: "vision",
    timings: { visualMs, visionMs, matchMs, totalMs: Date.now() - started },
  }
}

export type { DetectedCard }
