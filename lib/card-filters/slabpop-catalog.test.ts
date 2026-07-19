import { describe, expect, it } from "vitest"
import { MOCK_GRADED_CARDS } from "@/lib/card-filters/mock-catalog"

describe("mock catalog shape", () => {
  it("includes fields required by SlabPop live UI", () => {
    for (const card of MOCK_GRADED_CARDS) {
      expect(card.cardId).toBeTruthy()
      expect(card.image).toBeTruthy()
      expect(card.popSource).toBe("demo")
    }
  })
})
