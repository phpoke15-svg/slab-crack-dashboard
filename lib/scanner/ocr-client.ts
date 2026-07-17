"use client"

import { parseOcrText } from "@/lib/scanner/ocr-parse"
import type { DetectedCard } from "@/lib/slabcrack/identify-parse"

type OcrWorker = {
  recognize: (image: string) => Promise<{ data: { text: string } }>
  terminate: () => Promise<void>
}

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
        tessedit_pageseg_mode: "6", // single uniform block
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

/** Run on-device OCR and parse Pokémon card name + collector number. */
export async function recognizeCardText(imageDataUrl: string): Promise<DetectedCard | null> {
  const worker = await getOcrWorker()
  const { data } = await worker.recognize(imageDataUrl)
  return parseOcrText(data.text ?? "")
}
