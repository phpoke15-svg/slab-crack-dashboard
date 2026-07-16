import { describe, expect, it } from "vitest"
import {
  giveawayPrizeCalculationLine,
  giveawayPrizePayoutDetail,
  giveawayPrizePayoutSummary,
  giveawayPrizeRulesFormulaText,
} from "@/lib/giveaway/prize-formula"

describe("giveaway prize formula copy", () => {
  it("formats the live calculation line", () => {
    expect(giveawayPrizeCalculationLine(71)).toBe(
      "71 registered accounts × $0.10 per account = $7.10",
    )
  })

  it("matches rules formula text", () => {
    expect(giveawayPrizeRulesFormulaText()).toBe(
      "Prize ARV = (total registered user accounts on CollecTools) × $0.10 per account, up to a maximum cap of $4,999.00 USD per Promotion period.",
    )
  })

  it("shows cap on calculation line when account count exceeds the limit", () => {
    expect(giveawayPrizeCalculationLine(50_000)).toBe(
      "50,000 registered accounts × $0.10 per account = $5,000.00, capped at $4,999.00",
    )
  })

  it("states PayPal-only cash payout", () => {
    expect(giveawayPrizePayoutSummary()).toBe("The prize is paid in cash (USD) via PayPal only.")
    expect(giveawayPrizePayoutDetail()).toContain("PayPal only")
    expect(giveawayPrizePayoutDetail()).toContain("no physical prizes")
  })
})
