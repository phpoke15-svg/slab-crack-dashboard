import { describe, expect, it } from "vitest"
import { buildProbeHeaders, pickProbeProfile } from "./probe-profiles.js"

describe("probe-profiles", () => {
  it("includes modern browser headers for Chrome desktop", () => {
    const profile = pickProbeProfile(0)
    const headers = buildProbeHeaders(profile)

    expect(headers["User-Agent"]).toContain("Chrome")
    expect(headers.Accept).toContain("text/html")
    expect(headers["Accept-Language"]).toBeTruthy()
    expect(headers["Accept-Encoding"]).toContain("gzip")
    expect(headers["Sec-Fetch-Site"]).toBe("none")

    if (profile.id === "chrome-desktop-us") {
      expect(headers["sec-ch-ua"]).toContain("Google Chrome")
      expect(headers["sec-ch-ua-mobile"]).toBe("?0")
      expect(headers["sec-ch-ua-platform"]).toBe('"Windows"')
    }
  })

  it("includes Client Hints on Chrome Android", () => {
    const profile = pickProbeProfile(300_000)
    expect(profile.id).toBe("chrome-android")

    const headers = buildProbeHeaders(profile)
    expect(headers["sec-ch-ua-mobile"]).toBe("?1")
    expect(headers["sec-ch-ua-platform"]).toBe('"Android"')
  })
})
