import { describe, expect, it } from "vitest"
import { advanceHistoryCursor } from "@/lib/pricing/history-cursor"

describe("advanceHistoryCursor", () => {
  it("wraps to 0 after reaching catalog end", () => {
    expect(advanceHistoryCursor(0, 100, 250)).toBe(100)
    expect(advanceHistoryCursor(200, 50, 250)).toBe(0)
  })

  it("returns 0 for empty catalog", () => {
    expect(advanceHistoryCursor(0, 10, 0)).toBe(0)
  })
})
