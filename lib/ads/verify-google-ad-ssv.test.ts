import { describe, expect, it } from "vitest"
import { buildGoogleAdSsvMessage } from "@/lib/ads/verify-google-ad-ssv"

describe("buildGoogleAdSsvMessage", () => {
  it("concatenates query params in URL order excluding signature and key_id", () => {
    const url = new URL(
      "https://collectools.app/api/ads/record-completed-ad?ad_network=1&ad_unit=2&custom_data=user-abc&reward_amount=1&reward_item=coins&timestamp=123&transaction_id=tx-1&signature=sig&key_id=1",
    )
    expect(buildGoogleAdSsvMessage(url)).toBe(
      "ad_network=1&ad_unit=2&custom_data=user-abc&reward_amount=1&reward_item=coins&timestamp=123&transaction_id=tx-1",
    )
  })
})
