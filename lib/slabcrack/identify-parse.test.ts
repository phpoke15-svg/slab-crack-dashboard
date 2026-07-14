import { describe, expect, it } from "vitest"
import {
  cleanNumber,
  extractGeminiAnswerText,
  extractJsonObject,
  parseDetectedJson,
  thinkingConfigForModel,
} from "@/lib/slabcrack/identify-parse"

describe("identify-parse", () => {
  it("cleans collector numbers", () => {
    expect(cleanNumber("161/131")).toBe("161")
    expect(cleanNumber("#42")).toBe("42")
    expect(cleanNumber("215a")).toBe("215a")
  })

  it("extracts JSON from fenced Gemini output", () => {
    const raw = 'Sure.\n```json\n{"cardName":"Pikachu","setName":"Base","cardNumber":"58","confidence":0.9}\n```'
    expect(JSON.parse(extractJsonObject(raw)).cardName).toBe("Pikachu")
  })

  it("parses detected card JSON", () => {
    const detected = parseDetectedJson(
      JSON.stringify({
        cardName: "Umbreon ex",
        setName: "Prismatic Evolutions",
        cardNumber: "161/131",
        confidence: 0.88,
      }),
      "Gemini",
    )
    expect(detected.cardName).toBe("Umbreon ex")
    expect(detected.cardNumber).toBe("161")
    expect(detected.confidence).toBe(0.88)
  })

  it("ignores thought parts when answer text exists", () => {
    const extracted = extractGeminiAnswerText({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { thought: true, text: "thinking..." },
              {
                text: '{"cardName":"Mew","setName":"","cardNumber":"25","confidence":0.7}',
              },
            ],
          },
        },
      ],
    })
    expect(extracted.text).toContain("Mew")
  })

  it("falls back to thought text when answer parts are empty", () => {
    const extracted = extractGeminiAnswerText({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                thought: true,
                text: '{"cardName":"Charizard","setName":"","cardNumber":"4","confidence":0.6}',
              },
            ],
          },
        },
      ],
    })
    expect(extracted.text).toContain("Charizard")
  })

  it("picks the right thinking config per model family", () => {
    expect(thinkingConfigForModel("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 })
    expect(thinkingConfigForModel("gemini-3.5-flash")).toEqual({ thinkingLevel: "minimal" })
    expect(thinkingConfigForModel("gemini-flash-latest")).toBeNull()
  })
})
