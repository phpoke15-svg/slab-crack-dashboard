import { describe, expect, it } from "vitest"
import { isPokeWatchDropWindow } from "@/lib/pokemon-center/drop-window"

describe("isPokeWatchDropWindow", () => {
  it("is true Wed 11am ET", () => {
    expect(isPokeWatchDropWindow(new Date("2026-07-15T15:00:00.000Z"))).toBe(true)
  })

  it("is false Wed 9am ET", () => {
    expect(isPokeWatchDropWindow(new Date("2026-07-15T13:00:00.000Z"))).toBe(false)
  })

  it("is false Saturday noon ET", () => {
    expect(isPokeWatchDropWindow(new Date("2026-07-18T16:00:00.000Z"))).toBe(false)
  })
})
