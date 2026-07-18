import type { CardBounds, StabilitySample } from "@/lib/scanner/types"
import { boundsToPixels } from "@/lib/scanner/capture"
import { SCAN_STABILITY_BLUR_MIN, SCAN_STABILITY_HOLD_MS } from "@/lib/scanner/capture-settings"

const SAMPLE_W = 64
const SAMPLE_H = 90

/** Variance of Laplacian on grayscale — higher = sharper. */
function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = gray[y * w + x]!
      const lap =
        -4 * c +
        gray[(y - 1) * w + x]! +
        gray[(y + 1) * w + x]! +
        gray[y * w + (x - 1)]! +
        gray[y * w + (x + 1)]!
      sum += lap
      sumSq += lap * lap
      n += 1
    }
  }
  if (n === 0) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}

function toGray(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    gray[i] = rgba[o]! * 0.299 + rgba[o + 1]! * 0.587 + rgba[o + 2]! * 0.114
  }
  return gray
}

function meanAbsDiff(a: Float32Array, b: Float32Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!)
  return sum / a.length
}

export type StabilityGateOptions = {
  blurMin?: number
  motionMax?: number
  holdMs?: number
}

const DEFAULTS: Required<StabilityGateOptions> = {
  blurMin: SCAN_STABILITY_BLUR_MIN,
  motionMax: 8,
  holdMs: SCAN_STABILITY_HOLD_MS,
}

/**
 * Tracks preview stability between video frames.
 * Call `tick(video)` each animation frame; fires callback when hold threshold met.
 */
export class StabilityGate {
  private prevGray: Float32Array | null = null
  private stableSince = 0
  private lastSample: StabilitySample = { blur: 0, motion: 999, stable: false }
  private readonly opts: Required<StabilityGateOptions>

  constructor(opts?: StabilityGateOptions) {
    this.opts = { ...DEFAULTS, ...opts }
  }

  reset(): void {
    this.prevGray = null
    this.stableSince = 0
    this.lastSample = { blur: 0, motion: 999, stable: false }
  }

  get sample(): StabilitySample {
    return this.lastSample
  }

  /** Sample current video frame; returns true once when stable hold completes. */
  tick(video: HTMLVideoElement, bounds?: CardBounds, now = Date.now()): boolean {
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return false

    const fw = video.videoWidth
    const fh = video.videoHeight
    const region = bounds
      ? boundsToPixels(bounds, fw, fh)
      : { x: 0, y: 0, w: fw, h: fh }

    const canvas = document.createElement("canvas")
    canvas.width = SAMPLE_W
    canvas.height = SAMPLE_H
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(video, region.x, region.y, region.w, region.h, 0, 0, SAMPLE_W, SAMPLE_H)
    const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
    const gray = toGray(data, SAMPLE_W, SAMPLE_H)
    const blur = laplacianVariance(gray, SAMPLE_W, SAMPLE_H)
    const motion = this.prevGray ? meanAbsDiff(gray, this.prevGray) : 999
    this.prevGray = gray

    const stable = blur >= this.opts.blurMin && motion <= this.opts.motionMax
    this.lastSample = { blur, motion, stable }

    if (!stable) {
      this.stableSince = 0
      return false
    }

    if (this.stableSince === 0) this.stableSince = now
    return now - this.stableSince >= this.opts.holdMs
  }
}
