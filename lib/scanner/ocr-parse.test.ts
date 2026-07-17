import { describe, expect, it } from "vitest"
import { extractCollectorNumberFromText, parseOcrText } from "@/lib/scanner/ocr-parse"

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
})
