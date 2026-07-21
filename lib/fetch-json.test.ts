import { describe, expect, it } from "vitest"
import { fetchErrorMessage, readResponseJson } from "@/lib/fetch-json"

describe("readResponseJson", () => {
  it("returns null for plain-text error bodies", async () => {
    const res = new Response("An error occurred with this application.", { status: 500 })
    await expect(readResponseJson(res)).resolves.toBeNull()
  })

  it("parses valid JSON", async () => {
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 })
    await expect(readResponseJson<{ ok: boolean }>(res)).resolves.toEqual({ ok: true })
  })
})

describe("fetchErrorMessage", () => {
  it("prefers json error field", () => {
    const res = new Response(null, { status: 500 })
    expect(fetchErrorMessage(res, { error: "Card not found" }, "Fallback")).toBe("Card not found")
  })

  it("maps 500 without json to friendly copy", () => {
    const res = new Response(null, { status: 500 })
    expect(fetchErrorMessage(res, null, "Fallback")).toBe("Server error — try again in a moment")
  })
})
