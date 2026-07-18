import "server-only"

import {
  catalogHitToCardSearchHit,
  findCatalogCandidatesForDetected,
} from "@/lib/db/cards-catalog"
import { lookupCatalogCardEntry } from "@/lib/pricing/catalog-card-lookup"
import { identifyResultToScanPipeline } from "@/lib/scanner/scan-result"
import type { ScanPipelineResult } from "@/lib/scanner/types"
import {
  minAutoMatchScore,
  pickBestCatalogHit,
  pickRelaxedCatalogHit,
  sanitizeDetectedForMatch,
  type DetectedCard,
} from "@/lib/slabcrack/identify-parse"

function buildQuery(detected: DetectedCard): string {
  const parts = [detected.cardName, detected.cardNumber].filter(Boolean)
  return parts.join(" ").trim()
}

/** Instant local catalog + cached price match from OCR-detected name/number. */
export async function matchCatalogFromOcr(
  input: Partial<DetectedCard>,
): Promise<ScanPipelineResult | null> {
  const detected = sanitizeDetectedForMatch(input)
  if (!detected.cardNumber) return null

  const started = Date.now()
  const catalogHits = await findCatalogCandidatesForDetected(detected)
  if (!catalogHits.length) return null

  const candidates = catalogHits.map(catalogHitToCardSearchHit)
  let { hit, matchScore } = pickBestCatalogHit(candidates, detected)
  if (!hit) {
    const relaxed = pickRelaxedCatalogHit(candidates, detected)
    hit = relaxed.hit
    matchScore = relaxed.matchScore
  }
  if (!hit || matchScore < Math.min(minAutoMatchScore(detected), 48)) return null

  const card = await lookupCatalogCardEntry(hit.id)
  if (!card) return null

  return identifyResultToScanPipeline(
    {
      ok: true,
      detected,
      query: buildQuery(detected),
      hit,
      candidates,
      card,
      source: "gemini",
      matchScore,
      pricingSource: "local",
      needsLiveRefresh: card.hasPricing === false,
    },
    "ocr",
    { ocrMs: 0, matchMs: Date.now() - started, totalMs: Date.now() - started },
  )
}
