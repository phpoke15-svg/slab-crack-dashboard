import type { CardBounds } from "@/lib/scanner/types"
import {
  SCAN_CAPTURE_JPEG_QUALITY,
  SCAN_CAPTURE_MAX_EDGE,
} from "@/lib/scanner/capture-settings"

/** Standard Pokémon TCG aspect ratio (width / height). */
export const CARD_ASPECT = 63 / 88

/** Centered guide box for alignment (fraction of frame). */
export function defaultGuideBounds(videoW?: number, videoH?: number): CardBounds {
  const h = 0.68
  const aspect = videoW && videoH && videoW > 0 ? videoH / videoW : 9 / 16
  const w = h * CARD_ASPECT * aspect
  return {
    x: (1 - w) / 2,
    y: (1 - h) / 2,
    width: w,
    height: h,
  }
}

export function boundsToPixels(
  bounds: CardBounds,
  frameW: number,
  frameH: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(bounds.x * frameW),
    y: Math.round(bounds.y * frameH),
    w: Math.round(bounds.width * frameW),
    h: Math.round(bounds.height * frameH),
  }
}

/** Crop guide region from video and return JPEG data URL. */
export async function captureCardFromVideo(
  video: HTMLVideoElement,
  bounds?: CardBounds,
  maxEdge = SCAN_CAPTURE_MAX_EDGE,
  quality = SCAN_CAPTURE_JPEG_QUALITY,
): Promise<string> {
  const fw = video.videoWidth
  const fh = video.videoHeight
  if (fw <= 0 || fh <= 0) throw new Error("Camera frame not ready")

  const guide = bounds ?? defaultGuideBounds(fw, fh)
  const { x, y, w, h } = boundsToPixels(guide, fw, fh)
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const outW = Math.max(1, Math.round(w * scale))
  const outH = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not process camera frame")

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(video, x, y, w, h, 0, 0, outW, outH)
  return canvas.toDataURL("image/jpeg", quality)
}

/** Full frame fallback (smaller than legacy 768 edge). */
export async function captureFullFrame(
  video: HTMLVideoElement,
  maxEdge = 640,
  quality = 0.55,
): Promise<string> {
  const fw = video.videoWidth
  const fh = video.videoHeight
  if (fw <= 0 || fh <= 0) throw new Error("Camera frame not ready")

  const scale = Math.min(1, maxEdge / Math.max(fw, fh))
  const outW = Math.max(1, Math.round(fw * scale))
  const outH = Math.max(1, Math.round(fh * scale))

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not process camera frame")
  ctx.drawImage(video, 0, 0, outW, outH)
  return canvas.toDataURL("image/jpeg", quality)
}
