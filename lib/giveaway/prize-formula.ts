import {
  GIVEAWAY_PRIZE_ARV_CAP_USD,
  GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
  giveawayPrizeArvUsd,
} from "@/lib/giveaway/constants"

export function formatGiveawayUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

/** Plain-text formula shown under the prize value (matches Official Rules §5). */
export function giveawayPrizeCalculationLine(accountCount: number): string {
  const accounts = Math.max(0, Math.floor(accountCount))
  const uncapped = accounts * GIVEAWAY_PRIZE_PER_ACCOUNT_USD
  const prizeArv = giveawayPrizeArvUsd(accounts)
  const base = `${accounts.toLocaleString("en-US")} registered accounts × ${formatGiveawayUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)} per account = ${formatGiveawayUsd(uncapped)}`
  if (uncapped > GIVEAWAY_PRIZE_ARV_CAP_USD) {
    return `${base}, capped at ${formatGiveawayUsd(prizeArv)}`
  }
  return base
}

/** Short footnote for the giveaway page hero. */
export function giveawayPrizePageFootnote(): string {
  return `Prize ARV is registered accounts × ${formatGiveawayUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)} per account (maximum ${formatGiveawayUsd(GIVEAWAY_PRIZE_ARV_CAP_USD)} per Promotion period), counted when this page loads.`
}

/** Bullet text for Official Rules §5 — keep in sync with giveawayPrizeCalculationLine. */
export function giveawayPrizeRulesFormulaText(): string {
  return `Prize ARV = (total registered user accounts on CollecTools) × ${formatGiveawayUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)} per account, up to a maximum cap of ${formatGiveawayUsd(GIVEAWAY_PRIZE_ARV_CAP_USD)} USD per Promotion period.`
}

/** Cash payout method — keep in sync across giveaway page and Official Rules §5. */
export function giveawayPrizePayoutSummary(): string {
  return "The prize is paid in cash (USD) via PayPal only."
}

export function giveawayPrizePayoutDetail(): string {
  return "Winners receive a one-time cash payment equal to the calculated Prize ARV. Payment is made via PayPal only — no physical prizes, gift cards, checks, or other payment methods."
}
