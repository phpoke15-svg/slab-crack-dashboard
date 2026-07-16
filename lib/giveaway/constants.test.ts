import { describe, expect, it } from "vitest"
import {
  activeMinutesRequired,
  giveawayPrizeArvUsd,
  GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
  isLastDayOfMonth,
  isPremiumPlan,
  lastDayOfMonthIso,
  monthPeriod,
  MONTHLY_ENTRY_CAP,
  utcTodayIso,
} from "@/lib/giveaway/constants"

describe("giveaway constants", () => {
  it("prize scales at $0.10 per registered account snapshot", () => {
    expect(GIVEAWAY_PRIZE_PER_ACCOUNT_USD).toBe(0.1)
    expect(giveawayPrizeArvUsd(10_000)).toBe(1000)
    expect(giveawayPrizeArvUsd(25_000)).toBe(2500)
  })
  it("detects premium plans", () => {
    expect(isPremiumPlan("premium")).toBe(true)
    expect(isPremiumPlan("pro")).toBe(true)
    expect(isPremiumPlan("supreme")).toBe(true)
    expect(isPremiumPlan("free")).toBe(false)
  })

  it("uses 15 min for premium and 30 for free", () => {
    expect(activeMinutesRequired(true)).toBe(15)
    expect(activeMinutesRequired(false)).toBe(30)
  })

  it("formats month period", () => {
    expect(monthPeriod(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07")
    expect(utcTodayIso(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07-15")
  })

  it("resolves last calendar day of month in UTC", () => {
    expect(lastDayOfMonthIso("2026-07")).toBe("2026-07-31")
    expect(lastDayOfMonthIso("2026-02")).toBe("2026-02-28")
    expect(isLastDayOfMonth(new Date("2026-07-31T12:00:00Z"))).toBe(true)
    expect(isLastDayOfMonth(new Date("2026-07-30T12:00:00Z"))).toBe(false)
  })

  it("monthly cap is 28", () => {
    expect(MONTHLY_ENTRY_CAP).toBe(28)
  })
})
