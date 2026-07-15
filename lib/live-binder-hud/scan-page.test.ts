import { describe, expect, it } from "vitest"
import { parseBinderHudDetectJson } from "@/lib/live-binder-hud/parse-detect"

describe("binder hud box_2d JSON", () => {
  it("parses Gemini object-detection payload", () => {
    const cards = parseBinderHudDetectJson(`{
      "cards": [
        { "box_2d": [100, 50, 400, 300], "name": "Charizard", "set": "Base Set", "number": "4/102" },
        { "box_2d": [120, 350, 420, 600], "name": "Pikachu", "set": "Base Set", "number": "58/102" }
      ]
    }`)
    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({
      name: "Charizard",
      box_2d: [100, 50, 400, 300],
    })
    expect(cards[1]!.box_2d[1]).toBe(350)
  })

  it("drops invalid boxes", () => {
    const cards = parseBinderHudDetectJson(`{
      "cards": [
        { "box_2d": [10, 10, 10, 10], "name": "Bad" },
        { "box_2d": [0, 0, 500, 400], "name": "Good", "set": "", "number": "" }
      ]
    }`)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.name).toBe("Good")
  })
})
