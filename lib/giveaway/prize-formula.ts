import { GIVEAWAY_PRIZE_PER_ACCOUNT_USD, giveawayPrizeArvUsd } from "@/lib/giveaway/constants"

export function formatGiveawayUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

/** Plain-text formula shown under the prize value (matches Official Rules §5). */
export function giveawayPrizeCalculationLine(accountCount: number): string {
  const accounts = Math.max(0, Math.floor(accountCount))
  const prizeArv = giveawayPrizeArvUsd(accounts)
  return `${accounts.toLocaleString("en-US")} registered accounts × ${formatGiveawayUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)} per account = ${formatGiveawayUsd(prizeArv)}`
}

/** Short footnote for the giveaway page hero. */
export function giveawayPrizePageFootnote(): string {
  return "Prize ARV is the total number of registered CollecTools accounts multiplied by $0.10 per account, counted when this page loads."
}

/** Bullet text for Official Rules §5 — keep in sync with giveawayPrizeCalculationLine. */
export function giveawayPrizeRulesFormulaText(): string {
  return `Prize ARV = (total registered user accounts on CollecTools) × ${formatGiveawayUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)} per account.`
}
