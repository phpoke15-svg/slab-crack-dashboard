import { COLLECTOOLS_BASE_URL } from "../config"
import type { DetectedCard, ScanMatchCard, ScanMatchResult } from "./types"
import { hasOcrMatchFields } from "./ocr-parse"
import { matchCatalogFromOcr } from "./match-api"

type ApiCard = {
  id?: string
  cardName?: string
  setName?: string
  cardNumber?: string
  imageUrl?: string
  rawPrice?: number
  gradeQuotes?: Array<{ grade: number; slabPrice: number }>
}

type ScanApiResponse = {
  ok?: boolean
  error?: string
  detected?: DetectedCard
  query?: string
  card?: ApiCard | null
  matchScore?: number
}

function gradePrice(card: ApiCard | null | undefined, grade: number): number | undefined {
  const quote = card?.gradeQuotes?.find((q) => q.grade === grade)
  return quote?.slabPrice && quote.slabPrice > 0 ? quote.slabPrice : undefined
}

function toScanMatchCard(card: ApiCard | null | undefined): ScanMatchCard | null {
  if (!card?.id || !card.cardName) return null
  return {
    id: card.id,
    cardName: card.cardName,
    setName: card.setName ?? "",
    cardNumber: card.cardNumber ?? "",
    imageUrl: card.imageUrl ?? "",
    rawPrice: card.rawPrice ?? 0,
    psa9Price: gradePrice(card, 9),
    psa10Price: gradePrice(card, 10),
  }
}

function toScanMatchResult(json: ScanApiResponse): ScanMatchResult | null {
  if (!json.ok || !json.detected) return null
  return {
    ok: true,
    detected: json.detected,
    query: json.query ?? "",
    card: toScanMatchCard(json.card),
    matchScore: json.matchScore ?? 0,
  }
}

async function matchVisionSnapshot(
  imageDataUrl: string,
  detected?: DetectedCard | null,
): Promise<ScanMatchResult | null> {
  const res = await fetch(`${COLLECTOOLS_BASE_URL}/api/scanner/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: imageDataUrl,
      detected: hasOcrMatchFields(detected) ? detected : undefined,
    }),
  })

  const json = (await res.json().catch(() => null)) as ScanApiResponse | null
  if (!res.ok || !json?.ok) return null
  return toScanMatchResult(json)
}

/** OCR catalog match, then server vision fallback on the same snapshot. */
export async function matchPointScanSnapshot(
  imageDataUrl: string,
  detected: DetectedCard | null,
): Promise<ScanMatchResult | null> {
  if (hasOcrMatchFields(detected)) {
    const ocrResult = await matchCatalogFromOcr(detected!)
    if (ocrResult?.card) return ocrResult
  }

  return matchVisionSnapshot(imageDataUrl, detected)
}
