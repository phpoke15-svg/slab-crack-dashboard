import { describe, expect, it } from "vitest"
import { formatUnknownError } from "@/lib/scrydex/errors"

describe("formatUnknownError", () => {
  it("formats PostgREST-like objects", () => {
    expect(
      formatUnknownError({
        message: "duplicate key value violates unique constraint",
        code: "23505",
        details: "Key already exists.",
      }),
    ).toBe("duplicate key value violates unique constraint — code=23505 — Key already exists.")
  })

  it("falls back for opaque values", () => {
    expect(formatUnknownError({})).toBe("Unknown error")
  })
})
