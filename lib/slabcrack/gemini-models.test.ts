import { describe, expect, it } from "vitest"
import {
  geminiVisionModelCandidates,
  isGeminiModelUnavailable,
} from "@/lib/slabcrack/gemini-models"

describe("geminiVisionModelCandidates", () => {
  it("prefers 3.5 flash and de-dupes configured overrides", () => {
    expect(geminiVisionModelCandidates("gemini-3.5-flash")[0]).toBe("gemini-3.5-flash")
    expect(geminiVisionModelCandidates(null)[0]).toBe("gemini-3.5-flash")
    expect(geminiVisionModelCandidates("gemini-2.5-flash")).toEqual([
      "gemini-2.5-flash",
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
    ])
  })
})

describe("isGeminiModelUnavailable", () => {
  it("detects retired-model 404 payloads", () => {
    expect(
      isGeminiModelUnavailable(
        404,
        'This model models/gemini-2.5-flash is no longer available. Please update your code to use a newer model',
      ),
    ).toBe(true)
    expect(isGeminiModelUnavailable(400, "Unable to process input image")).toBe(false)
  })
})
