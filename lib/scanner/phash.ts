/**
 * Difference hash (dHash) — 64-bit perceptual fingerprint.
 * Shared between browser capture and server catalog index.
 */

const HASH_W = 9
const HASH_H = 8

export function dHashFromRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): bigint {
  const gray = sampleGrayGrid(rgba, width, height, HASH_W, HASH_H)
  let hash = 0n
  let bit = 0n
  for (let y = 0; y < HASH_H; y++) {
    for (let x = 0; x < HASH_W - 1; x++) {
      if (gray[y * HASH_W + x]! > gray[y * HASH_W + x + 1]!) {
        hash |= 1n << bit
      }
      bit += 1n
    }
  }
  return hash
}

function sampleGrayGrid(
  rgba: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  gridW: number,
  gridH: number,
): Float32Array {
  const out = new Float32Array(gridW * gridH)
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const sx = Math.min(srcW - 1, Math.floor((gx / gridW) * srcW))
      const sy = Math.min(srcH - 1, Math.floor((gy / gridH) * srcH))
      const o = (sy * srcW + sx) * 4
      out[gy * gridW + gx] =
        rgba[o]! * 0.299 + rgba[o + 1]! * 0.587 + rgba[o + 2]! * 0.114
    }
  }
  return out
}

export function dHashToHex(hash: bigint): string {
  return hash.toString(16).padStart(16, "0")
}

export function dHashFromHex(hex: string): bigint {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "")
  return BigInt(`0x${clean.padStart(16, "0")}`)
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b
  let count = 0
  while (x > 0n) {
    count += Number(x & 1n)
    x >>= 1n
  }
  return count
}

/** Browser: hash from image drawn on canvas. */
export async function dHashFromImageSource(
  source: CanvasImageSource,
  width = 128,
  height = 180,
): Promise<string> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas not available")
  ctx.drawImage(source, 0, 0, width, height)
  const { data } = ctx.getImageData(0, 0, width, height)
  return dHashToHex(dHashFromRgba(data, width, height))
}

/** Max Hamming distance to accept a visual catalog match (of 64 bits). */
export const PHASH_MATCH_MAX_DISTANCE = 14
