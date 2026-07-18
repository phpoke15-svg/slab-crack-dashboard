import "server-only"

import {
  catalogHitToCardSearchHit,
  findCatalogCandidatesForDetected,
} from "@/lib/db/cards-catalog"
import { lookupCatalogCardEntry } from "@/lib/pricing/catalog-card-lookup"
import { identifyResultToScanPipeline } from "@/lib/scanner/scan-result"
import type { ScanPipelineResult } from "@/lib/scanner/types"
import {
  cleanNumber,
  hasNameAgreement,
  minAutoMatchScore,
  pickBestCatalogHit,
  simplifyCardName,
  type DetectedCard,
} from "@/lib/slabcrack/identify-parse"

function normalizeDetected(input: Partial<DetectedCard>): DetectedCard {
  return {
    cardName: simplifyCardName(String(input.cardName ?? "")),
    setName: String(input.setName ?? "").trim(),
    cardNumber: cleanNumber(String(input.cardNumber ?? "")),
    confidence: Number.isFinite(input.confidence) ? Math.max(0, Math.min(1, input.confidence!)) : 0.75,
    notes: input.notes ?? "ocr",
  }
}

function buildQuery(detected: DetectedCard): string {
  const parts = [detected.cardName, detected.cardNumber].filter(Boolean)
  return parts.join(" ").trim()
}

/** Instant local catalog + cached price match from OCR-detected name/number. */
export async function matchCatalogFromOcr(
  input: Partial<DetectedCard>,
): Promise<ScanPipelineResult | null> {
  const detected = normalizeDetected(input)
  if (!detected.cardName || !detected.cardNumber) return null

  const started = Date.now()
  const catalogHits = await findCatalogCandidatesForDetected(detected)
  if (!catalogHits.length) return null

  const candidates = catalogHits.map(catalogHitToCardSearchHit)
  const { hit, matchScore } = pickBestCatalogHit(candidates, detected)
  if (!hit || matchScore < minAutoMatchScore(detected) || !hasNameAgreement(hit, detected)) {
    return null
  }

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
