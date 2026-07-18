import { describe, expect, it } from "vitest"
import {
  extractCollectorNumberFromText,
  hasOcrMatchFields,
  mergeOcrReads,
  parseOcrText,
  shouldTrustOcrDetected,
} from "@/lib/scanner/ocr-parse"

describe("extractCollectorNumberFromText", () => {
  it("parses fractional collector numbers", () => {
    expect(extractCollectorNumberFromText("4/102")).toBe("4")
    expect(extractCollectorNumberFromText("Card 185 / 190")).toBe("185")
    expect(extractCollectorNumberFromText("TG12/TG30")).toBe("TG12")
  })
})

describe("parseOcrText", () => {
  it("extracts card name and number from OCR lines", () => {
    const detected = parseOcrText(`Charizard
Stage 2
HP 120
4/102`)

    expect(detected?.cardName).toBe("Charizard")
    expect(detected?.cardNumber).toBe("4")
  })

  it("returns null when no useful text is found", () => {
    expect(parseOcrText("HP 120\nweakness")).toBeNull()
  })

  it("prefers shorter title-like lines over attack text", () => {
    const detected = parseOcrText(`Charizard
Resonance Strike
120 damage
4/102`)

    expect(detected?.cardName).toBe("Charizard")
    expect(detected?.cardNumber).toBe("4")
  })
})

describe("mergeOcrReads", () => {
  it("prefers name strip for card name and number strip for collector number", () => {
    const merged = mergeOcrReads(
      { cardName: "Char1zard", setName: "", cardNumber: "", confidence: 0.55, notes: "ocr" },
      { cardName: "Charizard", setName: "", cardNumber: "", confidence: 0.82, notes: "ocr" },
      { cardName: "", setName: "", cardNumber: "4", confidence: 0.82, notes: "ocr" },
    )

    expect(merged?.cardName).toBe("Charizard")
    expect(merged?.cardNumber).toBe("4")
    expect(merged?.confidence).toBeGreaterThanOrEqual(0.86)
  })

  it("falls back to full-card read when strips are empty", () => {
    const merged = mergeOcrReads(
      { cardName: "Pikachu", setName: "", cardNumber: "58", confidence: 0.82, notes: "ocr" },
      null,
      null,
    )

    expect(merged?.cardName).toBe("Pikachu")
    expect(merged?.cardNumber).toBe("58")
  })

  it("returns null when no fields are found", () => {
    expect(mergeOcrReads(null, null, null)).toBeNull()
  })
  it("requires minimum OCR fields before catalog match", () => {
    expect(
      hasOcrMatchFields({
        cardName: "Pikachu",
        setName: "",
        cardNumber: "25",
        confidence: 0.82,
        notes: "ocr",
      }),
    ).toBe(true)
  })
})

describe("shouldTrustOcrDetected", () => {
  it("trusts reads with both name and number at default confidence", () => {
    expect(
      shouldTrustOcrDetected({
        cardName: "Charizard",
        setName: "",
        cardNumber: "4",
        confidence: 0.82,
        notes: "ocr",
      }),
    ).toBe(true)
  })

  it("rejects low-confidence partial reads", () => {
    expect(
      shouldTrustOcrDetected({
        cardName: "Charizard",
        setName: "",
        cardNumber: "",
        confidence: 0.55,
        notes: "ocr",
      }),
    ).toBe(false)
  })

  it("trusts high-confidence single-field reads", () => {
    expect(
      shouldTrustOcrDetected({
        cardName: "",
        setName: "",
        cardNumber: "4",
        confidence: 0.9,
        notes: "ocr",
      }),
    ).toBe(true)
  })
})
