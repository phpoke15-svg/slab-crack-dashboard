"use client"

import { downscaleDataUrl } from "@/lib/scanner/capture"
import {
  SCAN_VISION_JPEG_QUALITY,
  SCAN_VISION_MAX_EDGE,
} from "@/lib/scanner/capture-settings"
import type { TcgResearchCardFull } from "@/lib/tcg-research/card-full"
import type { TcgGame } from "@/lib/scrydex/types"

export type TcgResearchScanOutcome =
  | { ok: true; payload: TcgResearchCardFull }
  | { ok: false; error: string }

/** Client helper: crop snapshot → Scrydex Vision → full TCG Research card payload. */
export async function matchTcgResearchSnapshot(
  snapshot: string,
  game: TcgGame,
): Promise<TcgResearchScanOutcome> {
  const visionCrop = await downscaleDataUrl(snapshot, SCAN_VISION_MAX_EDGE, SCAN_VISION_JPEG_QUALITY)
  const base64 = visionCrop.includes(",") ? visionCrop.split(",")[1] : visionCrop
  if (!base64) {
    return { ok: false, error: "Could not read camera capture." }
  }

  const res = await fetch("/api/tcg-research/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, game }),
  })

  const json = (await res.json().catch(() => null)) as (TcgResearchCardFull & { error?: string }) | null
  if (!res.ok || !json?.card) {
    return {
      ok: false,
      error: json?.error || "Scrydex Vision could not identify this card.",
    }
  }

  return { ok: true, payload: json }
}
