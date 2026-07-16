import { describe, expect, it } from "vitest"
import {
  giveawayPrizeCalculationLine,
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
      "Prize ARV = (total registered user accounts on CollecTools) × $0.10 per account.",
    )
  })
})
