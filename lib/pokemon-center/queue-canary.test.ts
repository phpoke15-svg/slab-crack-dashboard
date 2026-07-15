import { describe, expect, it } from "vitest"
import { probePokemonCenterQueueCanary } from "@/lib/pokemon-center/queue-canary"

describe("probePokemonCenterQueueCanary", () => {
  it("returns a structured result (network may be blocked in CI)", async () => {
    const result = await probePokemonCenterQueueCanary()
    expect(result).toMatchObject({
      checkedAt: expect.any(String),
      probeProfile: expect.any(String),
      statusCode: expect.any(Number),
    })
    expect(Array.isArray(result.signals)).toBe(true)
  })
})
