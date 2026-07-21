import { describe, expect, it } from "vitest"
import {
  isSlabItCacheFresh,
  isSlabItEligibleRelease,
  SLABIT_MAX_SET_AGE_YEARS,
} from "@/lib/slabit-config"

describe("slabit-config", () => {
  it("limits SlabIt to the past five years", () => {
    expect(SLABIT_MAX_SET_AGE_YEARS).toBe(5)
    expect(isSlabItEligibleRelease("2024-01-15", new Date("2026-07-21T12:00:00Z"))).toBe(true)
    expect(isSlabItEligibleRelease("2020-06-01", new Date("2026-07-21T12:00:00Z"))).toBe(false)
    expect(isSlabItEligibleRelease(null, new Date("2026-07-21T12:00:00Z"))).toBe(false)
  })

  it("treats cache as fresh for the same UTC day", () => {
    const now = new Date("2026-07-21T18:00:00Z")
    expect(isSlabItCacheFresh("2026-07-21T06:30:00.000Z", now)).toBe(true)
    expect(isSlabItCacheFresh("2026-07-20T23:59:00.000Z", now)).toBe(false)
  })
})
