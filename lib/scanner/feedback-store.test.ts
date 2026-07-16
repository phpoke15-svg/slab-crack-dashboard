import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const insertMock = vi.fn()
const singleMock = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createAdminClient: () => ({
    from: () => ({
      insert: (payload: unknown) => {
        insertMock(payload)
        return {
          select: () => ({
            single: singleMock,
          }),
        }
      },
    }),
  }),
}))

import { submitScannerMatchFeedback } from "@/lib/scanner/feedback-store"

describe("submitScannerMatchFeedback", () => {
  it("stores right/wrong with scan context", async () => {
    insertMock.mockClear()
    singleMock.mockResolvedValue({ data: { id: "fb-1" }, error: null })

    const result = await submitScannerMatchFeedback({
      userId: "user-1",
      correct: false,
      scanMode: "multi",
      presentedCardId: "poke-abc",
      cardName: "Pikachu",
      setName: "Base",
      cardNumber: "58",
      matchMethod: "vision",
      matchScore: 72,
      batchIndex: 2,
    })

    expect(result.id).toBe("fb-1")
    expect(insertMock).toHaveBeenCalledOnce()
    const payload = insertMock.mock.calls[0]?.[0]
    expect(payload).toMatchObject({
      user_id: "user-1",
      correct: false,
      scan_mode: "multi",
      presented_card_id: "poke-abc",
      match_method: "vision",
      batch_index: 2,
    })
  })
})
