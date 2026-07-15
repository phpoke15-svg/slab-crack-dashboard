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

  it("detects client-side queue on pokemoncenter.com URL (no redirect)", () => {
    const result = detectQueueFromContent({
      html: '<html><body><script src="https://assets.queue-it.net/static/queueconfig.js"></script></body></html>',
      url: "https://www.pokemoncenter.com/",
    })
    expect(result.live).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(90)
  })

  it("does not treat bare incident_id as blocked when queue signals are present", () => {
    const result = detectQueueFromContent({
      html: '<html>incident_id=abc<script src="https://queue-it.net/q.js"></script><p>Hi, Trainer</p></html>',
      url: "https://www.pokemoncenter.com/",
    })
    expect(result.live).toBe(true)
  })

  it("detects Queue-it cookies in page content", () => {
    const result = detectQueueFromContent({
      html: "document.cookie QueueITAccepted=1",
      url: "https://www.pokemoncenter.com/",
    })
    expect(result.live).toBe(true)
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
