import { describe, expect, it } from "vitest"
import { buildQueueWatchBookmarklet } from "@/lib/pokemon-center/bookmarklet"

describe("buildQueueWatchBookmarklet", () => {
  it("includes Imperva challenge detection and immediate challenge reporting", () => {
    const href = buildQueueWatchBookmarklet({
      origin: "https://www.collectools.app",
      sessionId: "test-session",
      token: "test-token",
    })
    expect(href).toContain("imperva-human-verify")
    expect(href).toContain("lastChallenge")
    expect(href).toContain("challengeEdge")
    expect(href).toContain("isChallengePage")
    expect(href).toContain("originOk")
    expect(href).toContain("heartbeat ping (silent)")
  })
})
