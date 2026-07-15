import { describe, expect, it } from "vitest"
import { normalizeBox, parseBinderHudDetectJson } from "@/lib/live-binder-hud/parse-detect"

describe("normalizeBox", () => {
  it("keeps 0–1000 box_2d", () => {
    expect(normalizeBox([100, 50, 400, 300])).toEqual([100, 50, 400, 300])
  })

  it("scales 0–1 floats to 0–1000", () => {
    expect(normalizeBox([0.1, 0.05, 0.4, 0.3])).toEqual([100, 50, 400, 300])
  })

  it("accepts xywh objects", () => {
    expect(normalizeBox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual([200, 100, 600, 400])
  })
})

describe("parseBinderHudDetectJson", () => {
  it("parses object cards payload", () => {
    const cards = parseBinderHudDetectJson(`{
      "cards": [
        { "box_2d": [100, 50, 400, 300], "name": "Charizard", "set": "Base Set", "number": "4/102" }
      ]
    }`)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.box_2d).toEqual([100, 50, 400, 300])
  })

  it("parses top-level array (Google cookbook shape)", () => {
    const cards = parseBinderHudDetectJson(`[
      { "box_2d": [10, 20, 500, 400], "name": "Pikachu", "set": "", "number": "" }
    ]`)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.name).toBe("Pikachu")
  })

  it("parses 0–1 coordinates", () => {
    const cards = parseBinderHudDetectJson(`{
      "cards": [
        { "box_2d": [0.05, 0.1, 0.55, 0.45], "name": "Mew", "set": "", "number": "" }
      ]
    }`)
    expect(cards[0]!.box_2d).toEqual([50, 100, 550, 450])
  })
})
