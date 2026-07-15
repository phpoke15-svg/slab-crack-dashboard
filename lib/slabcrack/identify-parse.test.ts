import { describe, expect, it } from "vitest"
import {
  cleanNumber,
  extractGeminiAnswerText,
  extractJsonObject,
  minAutoMatchScore,
  parseDetectedJson,
  scoreHit,
  simplifyCardName,
  thinkingConfigForModel,
} from "@/lib/slabcrack/identify-parse"

describe("identify-parse", () => {
  it("cleans collector numbers including prefixes and leading zeros", () => {
    expect(cleanNumber("161/131")).toBe("161")
    expect(cleanNumber("#42")).toBe("42")
    expect(cleanNumber("025")).toBe("25")
    expect(cleanNumber("215a")).toBe("215a")
    expect(cleanNumber("TG01")).toBe("TG1")
    expect(cleanNumber("GG70")).toBe("GG70")
  })

  it("simplifies rarity fluff from Gemini names", () => {
    expect(simplifyCardName("Umbreon ex Special Illustration Rare")).toBe("Umbreon ex")
    expect(simplifyCardName("Pikachu (Illustration Rare)")).toBe("Pikachu")
  })

  it("extracts JSON from fenced Gemini output", () => {
    const raw =
      'Sure.\n```json\n{"cardName":"Pikachu","setName":"Base","cardNumber":"58","confidence":0.9}\n```'
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
    expect(thinkingConfigForModel("gemini-flash-latest")).toEqual({ thinkingLevel: "minimal" })
  })

  it("scores catalog hits with bidirectional name/number matching", () => {
    const detected = {
      cardName: "Umbreon ex Special Illustration Rare",
      setName: "Prismatic Evolutions",
      cardNumber: "161",
      confidence: 0.9,
    }
    const hit = {
      cardName: "Umbreon ex",
      setName: "Prismatic Evolutions",
      cardNumber: "161/131",
    }
    expect(scoreHit(hit, detected)).toBeGreaterThanOrEqual(minAutoMatchScore(detected))
    expect(scoreHit({ ...hit, cardNumber: "025" }, { ...detected, cardNumber: "25" })).toBeGreaterThanOrEqual(
      50,
    )
  })

  it("requires a stronger score when a collector number is present", () => {
    expect(
      minAutoMatchScore({
        cardName: "Pikachu",
        setName: "",
        cardNumber: "25",
        confidence: 0.8,
      }),
    ).toBe(50)
    expect(
      minAutoMatchScore({
        cardName: "Pikachu",
        setName: "",
        cardNumber: "",
        confidence: 0.8,
      }),
    ).toBe(35)
  })
})
