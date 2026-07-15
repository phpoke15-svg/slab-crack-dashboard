import { describe, expect, it } from "vitest"
import { detectQueueFromContent, hasImpervaChallengeSignals } from "@/lib/pokemon-center/queue-detector"

describe("detectQueueFromContent", () => {
  it("marks Imperva challenge pages as blocked and not live", () => {
    const result = detectQueueFromContent({
      html: '<html>_Incapsula_Resource incident_id=123 Request unsuccessful</html>',
      url: "https://www.pokemoncenter.com/",
    })
    expect(result.blocked).toBe(true)
    expect(result.live).toBe(false)
    expect(result.confidence).toBe(0)
  })

  it("detects Queue-it waiting room", () => {
    const result = detectQueueFromContent({
      html: '<script src="https://queue-it.net/script.js"></script><p>Hi, Trainer</p>',
      url: "https://www.pokemoncenter.com/waitingroom",
    })
    expect(result.blocked).toBeFalsy()
    expect(result.live).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(60)
  })

  it("respects explicit blocked flag from datacenter fetch", () => {
    const result = detectQueueFromContent({
      html: "<html>normal storefront</html>",
      blocked: true,
    })
    expect(result.blocked).toBe(true)
    expect(result.live).toBe(false)
  })

  it("detects Imperva human verification as challenge (early drop signal)", () => {
    const result = detectQueueFromContent({
      html: '<div>Are you human? Please verify you\'re a human</div><div class="g-recaptcha"></div>',
      url: "https://www.pokemoncenter.com/",
    })
    expect(result.challenge).toBe(true)
    expect(hasImpervaChallengeSignals(result.signals)).toBe(true)
  })

  it("detects image matching CAPTCHA copy", () => {
    const result = detectQueueFromContent({
      html: "<p>Select all images with a bus</p>",
      url: "https://www.pokemoncenter.com/",
    })
    expect(result.challenge).toBe(true)
  })
})
