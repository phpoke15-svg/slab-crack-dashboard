import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { verifyScrydexWebhookSignature } from "@/lib/scrydex/webhook-signature"

describe("verifyScrydexWebhookSignature", () => {
  const secret = "whsec_test_secret"
  const rawBody = '{"id":"evt_1","name":"card.price_updated","data":{"scrydex_id":"base1-4"}}'

  it("accepts valid signatures within replay window", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")

    expect(
      verifyScrydexWebhookSignature(
        rawBody,
        `t=${timestamp},v1=${signature}`,
        secret,
        Date.now(),
      ),
    ).toBe(true)
  })

  it("rejects tampered payloads", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")

    expect(
      verifyScrydexWebhookSignature(
        `${rawBody.slice(0, -1)}`,
        `t=${timestamp},v1=${signature}`,
        secret,
        Date.now(),
      ),
    ).toBe(false)
  })

  it("rejects stale timestamps", () => {
    const timestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString()
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")

    expect(
      verifyScrydexWebhookSignature(
        rawBody,
        `t=${timestamp},v1=${signature}`,
        secret,
        Date.now(),
      ),
    ).toBe(false)
  })
})
