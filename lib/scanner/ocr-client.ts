"use client"

import {
  mergeOcrReads,
  parseOcrText,
  shouldTrustOcrDetected,
} from "@/lib/scanner/ocr-parse"
import { preprocessOcrImage, preprocessOcrRegion } from "@/lib/scanner/ocr-preprocess"
import type { DetectedCard } from "@/lib/slabcrack/identify-parse"
import type { CardBounds } from "@/lib/scanner/types"

export { shouldTrustOcrDetected }

type OcrWorker = {
  recognize: (image: string) => Promise<{ data: { text: string } }>
  setParameters: (params: Record<string, string>) => Promise<unknown>
  terminate: () => Promise<void>
}

const NAME_REGION: CardBounds = { x: 0.06, y: 0.05, width: 0.88, height: 0.24 }
const NUMBER_REGION: CardBounds = { x: 0.06, y: 0.8, width: 0.88, height: 0.16 }

let workerPromise: Promise<OcrWorker> | null = null
let workerRefCount = 0

async function getOcrWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js")
      const worker = await createWorker("eng", 1, {
        logger: () => {},
      })
      await worker.setParameters({
        tessedit_pageseg_mode: "3",
        preserve_interword_spaces: "1",
      })
      return worker
    })()
  }
  workerRefCount += 1
  return workerPromise
}

export async function preloadOcrWorker(): Promise<void> {
  try {
    await getOcrWorker()
  } catch {
    /* optional warm-up */
  }
}

export async function releaseOcrWorker(): Promise<void> {
  workerRefCount = Math.max(0, workerRefCount - 1)
  if (workerRefCount > 0 || !workerPromise) return

  const worker = await workerPromise.catch(() => null)
  workerPromise = null
  if (worker) await worker.terminate().catch(() => {})
}

async function recognizePrepared(
  worker: OcrWorker,
  prepared: string,
  singleLine = false,
): Promise<string> {
  if (singleLine) {
    await worker.setParameters({ tessedit_pageseg_mode: "7" })
  } else {
    await worker.setParameters({ tessedit_pageseg_mode: "3" })
  }
  const { data } = await worker.recognize(prepared)
  return data.text ?? ""
}

/** Run on-device OCR on full card + name/number strips for better accuracy. */
export async function recognizeCardText(imageDataUrl: string): Promise<DetectedCard | null> {
  const worker = await getOcrWorker()

  const [fullPrepared, namePrepared, numberPrepared] = await Promise.all([
    preprocessOcrImage(imageDataUrl),
    preprocessOcrRegion(imageDataUrl, NAME_REGION),
    preprocessOcrRegion(imageDataUrl, NUMBER_REGION),
  ])

  const fullText = await recognizePrepared(worker, fullPrepared, false)
  const nameText = await recognizePrepared(worker, namePrepared, true)
  const numberText = await recognizePrepared(worker, numberPrepared, true)

  return mergeOcrReads(
    parseOcrText(fullText),
    parseOcrText(nameText),
    parseOcrText(numberText),
  )
}
