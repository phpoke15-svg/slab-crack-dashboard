import { describe, expect, it } from "vitest"
import { parseCardBoxesJson } from "@/lib/slabcrack/detect-card-boxes-parse"

describe("parseCardBoxesJson", () => {
  it("parses and clamps card boxes", () => {
    const boxes = parseCardBoxesJson(
      JSON.stringify({
        cards: [
          { x: 0.1, y: 0.2, w: 0.25, h: 0.35, confidence: 0.9 },
          { x: -0.1, y: 0.5, width: 0.2, height: 0.3, confidence: 1.2 },
          { x: 0.4, y: 0.4, w: 0.01, h: 0.01, confidence: 0.8 },
        ],
      }),
      "test",
    )
    expect(boxes).toHaveLength(2)
    // Higher confidence first after clamp.
    expect(boxes[0]).toMatchObject({ x: 0, y: 0.5, w: 0.2, h: 0.3, confidence: 1 })
    expect(boxes[1]).toMatchObject({ x: 0.1, y: 0.2, w: 0.25, h: 0.35, confidence: 0.9 })
  })
})
