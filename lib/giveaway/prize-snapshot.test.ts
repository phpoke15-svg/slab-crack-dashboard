import { describe, expect, it } from "vitest"
import { buildPrizeSnapshot } from "@/lib/giveaway/prize-snapshot"

describe("giveaway prize snapshot", () => {
  it("builds ARV from account count × $0.10", () => {
    const snap = buildPrizeSnapshot("2026-07", 71, "2026-07-16T12:00:00.000Z")
    expect(snap.accountSnapshot).toBe(71)
    expect(snap.prizeArvUsd).toBe(7.1)
    expect(snap.prizePerAccountUsd).toBe(0.1)
  })

  it("includes daily snapshot metadata when provided", () => {
    const snap = buildPrizeSnapshot("2026-07", 71, "2026-07-16T12:00:00.000Z", {
      snapshotDate: "2026-07-16",
      isMonthEndFinal: false,
    })
    expect(snap.snapshotDate).toBe("2026-07-16")
    expect(snap.isMonthEndFinal).toBe(false)
  })

  it("marks month-end snapshots as final", () => {
    const snap = buildPrizeSnapshot("2026-07", 100, "2026-07-31T04:30:00.000Z", {
      snapshotDate: "2026-07-31",
      isMonthEndFinal: true,
    })
    expect(snap.isMonthEndFinal).toBe(true)
    expect(snap.prizeArvUsd).toBe(10)
  })
})
