import { describe, expect, it } from "vitest"

// Mirror of parse rules used by scanBinderPage (kept local to avoid exporting server-only).
function parseCardsJson(text: string) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    cards?: Array<Record<string, unknown>>
  }
  return (parsed.cards || [])
    .map((c) => ({
      slot: Number(c.slot),
      name: String(c.name || "").trim(),
      set: String(c.set || "").trim(),
      number: String(c.number || "").trim(),
    }))
    .filter((c) => c.slot >= 1 && c.slot <= 9 && c.name)
}

describe("binder hud scan JSON", () => {
  it("parses the contracted card list", () => {
    const cards = parseCardsJson(`{
      "cards": [
        { "slot": 1, "name": "Charizard", "set": "Base Set", "number": "4/102" },
        { "slot": 5, "name": "Pikachu", "set": "Base Set", "number": "58/102" }
      ]
    }`)
    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({ slot: 1, name: "Charizard", number: "4/102" })
  })
})
