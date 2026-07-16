import { describe, expect, it } from "vitest"
import {
  dHashFromHex,
  dHashFromRgba,
  dHashToHex,
  hammingDistance,
  PHASH_MATCH_MAX_DISTANCE,
} from "@/lib/scanner/phash"

function solidRgba(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
    data[o + 3] = 255
  }
  return data
}

describe("phash", () => {
  it("produces stable 16-char hex hashes", () => {
    const rgba = solidRgba(128, 180, 40, 40, 40)
    const hash = dHashFromRgba(rgba, 128, 180)
    const hex = dHashToHex(hash)
    expect(hex).toHaveLength(16)
    expect(dHashFromHex(hex)).toBe(hash)
  })

  it("returns zero hamming distance for identical hashes", () => {
    const a = dHashFromRgba(solidRgba(128, 180, 10, 10, 10), 128, 180)
    const b = dHashFromRgba(solidRgba(128, 180, 10, 10, 10), 128, 180)
    expect(hammingDistance(a, b)).toBe(0)
  })

  it("computes hamming distance from xor popcount", () => {
    expect(hammingDistance(0n, 0n)).toBe(0)
    expect(hammingDistance(0b1111n, 0b1010n)).toBe(2)
    expect(hammingDistance(dHashFromHex("f".repeat(16)), dHashFromHex("0".repeat(16)))).toBe(64)
  })
})
