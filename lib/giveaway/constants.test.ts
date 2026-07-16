import { describe, expect, it } from "vitest"
import {
  activeMinutesRequired,
  FREE_ACTIVE_MINUTES_REQUIRED,
  giveawayPrizeArvUsd,
  GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
  isPremiumPlan,
  monthPeriod,
  MONTHLY_ENTRY_CAP,
  PREMIUM_ACTIVE_MINUTES_REQUIRED,
  PRO_ACTIVE_MINUTES_REQUIRED,
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

  it("uses tiered active-minute thresholds", () => {
    expect(activeMinutesRequired("free")).toBe(FREE_ACTIVE_MINUTES_REQUIRED)
    expect(activeMinutesRequired("premium")).toBe(PREMIUM_ACTIVE_MINUTES_REQUIRED)
    expect(activeMinutesRequired("pro")).toBe(PRO_ACTIVE_MINUTES_REQUIRED)
    expect(activeMinutesRequired("supreme")).toBe(PRO_ACTIVE_MINUTES_REQUIRED)
  })

  it("formats month period", () => {
    expect(monthPeriod(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07")
    expect(utcTodayIso(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07-15")
  })

  it("monthly cap is 28", () => {
    expect(MONTHLY_ENTRY_CAP).toBe(28)
  })
})
