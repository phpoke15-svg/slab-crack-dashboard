import { describe, expect, it } from "vitest"
import { boundsToPixels, CARD_ASPECT, defaultGuideBounds } from "@/lib/scanner/capture"

describe("capture", () => {
  it("uses standard card aspect ratio", () => {
    expect(CARD_ASPECT).toBeCloseTo(63 / 88, 5)
  })

  it("centers guide bounds in portrait video", () => {
    const guide = defaultGuideBounds(720, 1280)
    expect(guide.x).toBeGreaterThan(0)
    expect(guide.y).toBeGreaterThan(0)
    expect(guide.x + guide.width).toBeLessThan(1)
    expect(guide.y + guide.height).toBeLessThan(1)
  })

  it("converts normalized bounds to pixels", () => {
    const guide = { x: 0.1, y: 0.2, width: 0.5, height: 0.6 }
    expect(boundsToPixels(guide, 1000, 800)).toEqual({ x: 100, y: 160, w: 500, h: 480 })
  })
})
