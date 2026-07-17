import type { IdentifyCardResult } from "@/lib/slabcrack/identify-card"
import type { ScanPipelineResult } from "@/lib/scanner/types"

export function identifyResultToScanPipeline(
  result: IdentifyCardResult,
  matchMethod: ScanPipelineResult["matchMethod"],
  timings?: ScanPipelineResult["timings"],
): ScanPipelineResult {
  return {
    ok: true,
    detected: result.detected,
    query: result.query,
    hit: result.hit,
    candidates: result.candidates,
    card: result.card,
    source: result.source,
    matchScore: result.matchScore,
    pricingSource: result.pricingSource,
    needsLiveRefresh: result.needsLiveRefresh,
    matchMethod,
    timings,
  }
}
