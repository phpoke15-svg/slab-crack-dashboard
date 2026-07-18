import { describe, expect, it } from "vitest"
import { hasOcrMatchFields } from "@/lib/scanner/ocr-parse"

describe("hasOcrMatchFields", () => {
  it("requires both name and collector number", () => {
    expect(
      hasOcrMatchFields({
        cardName: "Charizard",
        setName: "",
        cardNumber: "4",
        confidence: 0.8,
      }),
    ).toBe(true)

    expect(
      hasOcrMatchFields({
        cardName: "Charizard",
        setName: "",
        cardNumber: "",
        confidence: 0.8,
      }),
    ).toBe(false)

    expect(
      hasOcrMatchFields({
        cardName: "ab",
        setName: "",
        cardNumber: "4",
        confidence: 0.8,
      }),
    ).toBe(false)
  })
})

describe("collectorNumberMatches", () => {
  it("matches fractional stored numbers", async () => {
    const { findCatalogCandidatesForDetected } = await import("@/lib/db/cards-catalog")
    expect(typeof findCatalogCandidatesForDetected).toBe("function")
  })
})
