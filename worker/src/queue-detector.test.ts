import { describe, expect, it } from "vitest"
import {
  analyzeHeadResponse,
  createDebounceState,
  CHECK_INTERVAL_MS,
  DEBOUNCE_WINDOW_MS,
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
    expect(result.blocked).toBe(false)
    expect(result.queueUrl).toContain("queue-it.net")
  })

  it("detects queue.pokemoncenter.com redirects", () => {
    expect(isQueueRedirectLocation("https://queue.pokemoncenter.com/enter")).toBe(true)
  })

  it("ignores non-queue redirects", () => {
    const result = analyzeHeadResponse(302, "https://www.pokemoncenter.com/login")
    expect(result.live).toBe(false)
    expect(result.blocked).toBe(false)
  })

  it("treats Imperva 403 as blocked, not LIVE", () => {
    const result = analyzeHeadResponse(403, null, {
      html: "<html>Access Denied</html>",
    })
    expect(result.live).toBe(false)
    expect(result.blocked).toBe(true)
  })

  it("detects queue-it markers in HTML without redirect", () => {
    const result = analyzeHeadResponse(200, null, {
      html: '<script src="https://assets.queue-it.net/static/queueconfig.js"></script>',
    })
    expect(result.live).toBe(true)
    expect(result.blocked).toBe(false)
  })

  it("requires two consecutive LIVE hits within the debounce window", () => {
    const state = createDebounceState()
    const now = Date.now()

    expect(registerLiveHit(state, now)).toBe(false)
    expect(registerLiveHit(state, now + CHECK_INTERVAL_MS)).toBe(true)

    resetLiveDebounce(state)
    expect(registerLiveHit(state, now + DEBOUNCE_WINDOW_MS + 1_000)).toBe(false)
  })
})
