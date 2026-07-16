import "server-only"
import { detectCardBoxes } from "@/lib/slabcrack/detect-card-boxes"
import type { DetectedCardBox } from "@/lib/slabcrack/detect-card-boxes-parse"
import { cropDataUrlRegionServer, phashFromDataUrlServer } from "@/lib/scanner/crop-server"
import { scanCardPipeline } from "@/lib/scanner/scan-pipeline"
import type { BatchScanCardResult, BatchScanItemInput, BatchScanResult } from "@/lib/scanner/types"

const IDENTIFY_CONCURRENCY = 3

async function runPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!, i)
    }
  }

  const workers = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

function toBounds(box: DetectedCardBox) {
  return {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    confidence: box.confidence,
  }
}

async function identifyItem(
  item: BatchScanItemInput,
  index: number,
): Promise<BatchScanCardResult> {
  try {
    const result = await scanCardPipeline({
      image: item.image,
      phash: item.phash,
    })
    return { index, bounds: item.bounds, ok: true, result }
  } catch (error) {
    return {
      index,
      bounds: item.bounds,
      ok: false,
      error: error instanceof Error ? error.message : "Identify failed",
    }
  }
}

export type ScanBatchInput = {
  /** Full-frame capture (detect + crop server-side when items omitted). */
  image?: string
  /** Pre-cropped cards from client (skips detect). */
  items?: BatchScanItemInput[]
}

export async function scanBatchPipeline(input: ScanBatchInput): Promise<BatchScanResult> {
  const started = Date.now()
  let detectMs = 0
  let detectSource: "gemini" | "openai" | undefined
  let items = input.items ?? []

  if (!items.length) {
    const frame = input.image?.trim()
    if (!frame) throw new Error("image or items is required")

    const detectStart = Date.now()
    const detected = await detectCardBoxes(frame)
    detectMs = Date.now() - detectStart
    detectSource = detected.source

    if (!detected.boxes.length) {
      throw new Error("No cards detected — fit 1–9 cards in frame and try again.")
    }

    items = await Promise.all(
      detected.boxes.map(async (box) => {
        const crop = await cropDataUrlRegionServer(frame, box)
        const phash = await phashFromDataUrlServer(crop)
        return { image: crop, phash, bounds: toBounds(box) }
      }),
    )
  }

  const identifyStart = Date.now()
  const cards = await runPool(items, IDENTIFY_CONCURRENCY, identifyItem)
  const identifyMs = Date.now() - identifyStart

  return {
    ok: true,
    cardCount: cards.length,
    cards,
    detectSource,
    timings: {
      detectMs,
      identifyMs,
      totalMs: Date.now() - started,
    },
  }
}
