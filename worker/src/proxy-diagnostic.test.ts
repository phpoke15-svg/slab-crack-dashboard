import { describe, expect, it } from "vitest"
import { parseIpFromBody } from "./proxy-ip-parse.js"

describe("proxy-diagnostic", () => {
  it("parses plain-text IP from icanhazip", () => {
    expect(parseIpFromBody("203.0.113.10\n")).toBe("203.0.113.10")
  })

  it("parses JSON IP from httpbin-style responses", () => {
    expect(parseIpFromBody('{"origin":"198.51.100.4"}')).toBe("198.51.100.4")
  })

  it("returns null for invalid bodies", () => {
    expect(parseIpFromBody("not-an-ip")).toBeNull()
  })
})
