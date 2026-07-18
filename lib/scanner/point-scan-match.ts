"use client"

import { downscaleDataUrl } from "@/lib/scanner/capture"
import {
  SCAN_VISION_JPEG_QUALITY,
  SCAN_VISION_MAX_EDGE,
} from "@/lib/scanner/capture-settings"
import { recognizeCardText } from "@/lib/scanner/ocr-client"
import { hasOcrMatchFields, shouldTrustOcrDetected } from "@/lib/scanner/ocr-parse"
import { dHashFromImageSource } from "@/lib/scanner/phash"
import type { ScanPipelineResult } from "@/lib/scanner/types"

async function phashFromDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      void dHashFromImageSource(img, 128, 180).then(resolve).catch(reject)
    }
    img.onerror = () => reject(new Error("Could not read image for fingerprint"))
    img.src = dataUrl
  })
}

export type PointScanMatchOutcome =
  | { ok: true; result: ScanPipelineResult }
  | { ok: false; error: string }

/** Fast OCR catalog match, then vision + phash fallback on the same snapshot. */
export async function matchPointScanSnapshot(
  snapshot: string,
): Promise<PointScanMatchOutcome> {
  const detected = await recognizeCardText(snapshot).catch(() => null)

  if (hasOcrMatchFields(detected) && shouldTrustOcrDetected(detected)) {
    const res = await fetch("/api/scanner/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detected }),
    })
    const json = (await res.json().catch(() => null)) as
      | (ScanPipelineResult & { error?: string })
      | null
    if (res.ok && json?.ok) {
      return { ok: true, result: json as ScanPipelineResult }
    }
  }

  const [visionCrop, phash] = await Promise.all([
    downscaleDataUrl(snapshot, SCAN_VISION_MAX_EDGE, SCAN_VISION_JPEG_QUALITY),
    phashFromDataUrl(snapshot),
  ])

  const res = await fetch("/api/scanner/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: visionCrop,
      phash,
      detected: hasOcrMatchFields(detected) ? detected : undefined,
    }),
  })
  const json = (await res.json().catch(() => null)) as
    | (ScanPipelineResult & { error?: string })
    | null

  if (!res.ok || !json?.ok) {
    return { ok: false, error: json?.error || "Could not identify this card." }
  }

  return { ok: true, result: json as ScanPipelineResult }
}
