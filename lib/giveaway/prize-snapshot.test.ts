import { describe, expect, it } from "vitest"
import { buildPrizeSnapshot, monthSnapshotInstantIso } from "@/lib/giveaway/prize-snapshot"

describe("giveaway prize snapshot", () => {
  it("uses UTC midnight on the first of the month", () => {
    expect(monthSnapshotInstantIso("2026-07")).toBe("2026-07-01T00:00:00.000Z")
  })

  it("builds ARV from account count × $0.10", () => {
    const snap = buildPrizeSnapshot("2026-07", 10_000)
    expect(snap.accountSnapshot).toBe(10_000)
    expect(snap.prizeArvUsd).toBe(1000)
    expect(snap.prizePerAccountUsd).toBe(0.1)
  })
})
