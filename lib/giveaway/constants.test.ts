import { describe, expect, it } from "vitest"
import {
  activeMinutesRequired,
  AD_SYNTHETIC_MINUTES_PER_WATCH,
  DAILY_AD_WATCH_LIMIT,
  FREE_ACTIVE_MINUTES_REQUIRED,
  giveawayPrizeArvUsd,
  giveawayTierFeatureLine,
  GIVEAWAY_PRIZE_ARV_CAP_USD,
  GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
  isPremiumPlan,
  monthPeriod,
  MONTHLY_ENTRY_CAP,
  PREMIUM_ACTIVE_MINUTES_REQUIRED,
  PRO_ACTIVE_MINUTES_REQUIRED,
  qualifyingActiveMinutes,
  utcTodayIso,
} from "@/lib/giveaway/constants"

describe("giveaway constants", () => {
  it("prize scales at $0.10 per registered account snapshot", () => {
    expect(GIVEAWAY_PRIZE_PER_ACCOUNT_USD).toBe(0.1)
    expect(giveawayPrizeArvUsd(10_000)).toBe(1000)
    expect(giveawayPrizeArvUsd(25_000)).toBe(2500)
  })

  it("caps prize ARV at $4,999", () => {
    expect(GIVEAWAY_PRIZE_ARV_CAP_USD).toBe(4999)
    expect(giveawayPrizeArvUsd(50_000)).toBe(4999)
    expect(giveawayPrizeArvUsd(500_000)).toBe(4999)
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

  it("formats tier giveaway feature lines", () => {
    expect(giveawayTierFeatureLine("free")).toContain("30 active minutes")
    expect(giveawayTierFeatureLine("premium")).toContain("10 active minutes")
    expect(giveawayTierFeatureLine("pro")).toContain("5 active minutes")
    expect(giveawayTierFeatureLine("pro")).toContain("PayPal")
  })

  it("formats month period", () => {
    expect(monthPeriod(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07")
    expect(utcTodayIso(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07-15")
  })

  it("monthly cap is 28", () => {
    expect(MONTHLY_ENTRY_CAP).toBe(28)
  })

  it("adds synthetic ad minutes for free users only", () => {
    expect(qualifyingActiveMinutes(10, 2, "free")).toBe(10 + 2 * AD_SYNTHETIC_MINUTES_PER_WATCH)
    expect(qualifyingActiveMinutes(10, 3, "free")).toBe(40)
    expect(qualifyingActiveMinutes(10, 3, "premium")).toBe(10)
    expect(DAILY_AD_WATCH_LIMIT).toBe(3)
  })
})
