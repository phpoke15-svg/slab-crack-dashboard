import { describe, expect, it } from "vitest"
import { ScrydexApiError } from "@/lib/scrydex/errors"
import { ScrydexCreditBudgetError } from "@/lib/scrydex/credit-ledger"
import { mapVisionScanErrorStatus } from "@/lib/scrydex/scan-errors"
import { InvalidVisionImageError } from "@/lib/scrydex/errors"
import { ScrydexVisionNoMatchError } from "@/lib/scrydex/vision-pipeline"

describe("mapVisionScanErrorStatus", () => {
  it("maps client and upstream errors to safe HTTP statuses", () => {
    expect(mapVisionScanErrorStatus(new InvalidVisionImageError())).toBe(400)
    expect(mapVisionScanErrorStatus(new ScrydexCreditBudgetError("budget"))).toBe(429)
    expect(mapVisionScanErrorStatus(new ScrydexVisionNoMatchError())).toBe(422)
    expect(mapVisionScanErrorStatus(new ScrydexApiError(500, "Scrydex 500"))).toBe(502)
    expect(mapVisionScanErrorStatus(new ScrydexApiError(404, "Scrydex 404"))).toBe(422)
    expect(mapVisionScanErrorStatus(new Error("Scrydex 500: upstream"))).toBe(502)
    expect(mapVisionScanErrorStatus(new Error("Scrydex Vision returned no match"))).toBe(422)
  })
})
