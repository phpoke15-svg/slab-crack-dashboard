import { describe, expect, it } from "vitest"
import {
  analyzeHeadResponse,
  createDebounceState,
  isQueueRedirectLocation,
  registerLiveHit,
  resetLiveDebounce,
} from "./queue-detector.js"

describe("queue-detector", () => {
  it("detects queue-it redirects as LIVE", () => {
    const result = analyzeHeadResponse(
      302,
      "https://pokemoncenter.queue-it.net/?c=pokemoncenter&e=drop",
    )
    expect(result.live).toBe(true)
    expect(result.queueUrl).toContain("queue-it.net")
  })

  it("detects queue.pokemoncenter.com redirects", () => {
    expect(isQueueRedirectLocation("https://queue.pokemoncenter.com/enter")).toBe(true)
  })

  it("ignores non-queue redirects", () => {
    const result = analyzeHeadResponse(302, "https://www.pokemoncenter.com/login")
    expect(result.live).toBe(false)
  })

  it("requires two consecutive LIVE hits within 10 seconds", () => {
    const state = createDebounceState()
    const now = Date.now()

    expect(registerLiveHit(state, now)).toBe(false)
    expect(registerLiveHit(state, now + 2_000)).toBe(true)

    resetLiveDebounce(state)
    expect(registerLiveHit(state, now + 20_000)).toBe(false)
  })
})
