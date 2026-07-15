import { describe, expect, it } from "vitest"
import {
  isQueueWatchWorkerSessionId,
  verifyQueueWatchWorkerSecret,
} from "@/lib/pokemon-center/queue-watch-worker-auth"

describe("queue-watch-worker-auth", () => {
  it("accepts remote-monitor session ids", () => {
    expect(isQueueWatchWorkerSessionId("remote-monitor")).toBe(true)
    expect(isQueueWatchWorkerSessionId("remote-monitor-fly")).toBe(true)
    expect(isQueueWatchWorkerSessionId("user-session")).toBe(false)
  })

  it("verifies bearer worker secret", () => {
    const prev = process.env.QUEUE_WATCH_WORKER_SECRET
    process.env.QUEUE_WATCH_WORKER_SECRET = "test-secret"
    const request = new Request("https://example.com", {
      headers: { Authorization: "Bearer test-secret" },
    })
    expect(verifyQueueWatchWorkerSecret(request)).toBe(true)
    process.env.QUEUE_WATCH_WORKER_SECRET = prev
  })
})
