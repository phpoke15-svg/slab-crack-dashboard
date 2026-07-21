import { describe, expect, it } from "vitest"
import { stripVisionImageBase64 } from "@/lib/scrydex/vision-image"

describe("stripVisionImageBase64", () => {
  it("removes data URL prefix and whitespace", () => {
    expect(stripVisionImageBase64("data:image/jpeg;base64,abc123")).toBe("abc123")
    expect(stripVisionImageBase64(" abc\r\n123 ")).toBe("abc123")
  })
})
