import type { PrizeSnapshot } from "@/lib/giveaway/prize-snapshot"
import type { GiveawayPrizeCard, PrizeCardPriceBand } from "@/lib/giveaway/prize-cards"

export type GiveawayPrizePayload = Pick<
  PrizeSnapshot,
  "monthPeriod" | "snapshotAt" | "accountSnapshot" | "prizePerAccountUsd" | "prizeArvUsd"
> & {
  snapshotDate?: string
}

export type GiveawayPagePrizeData = {
  prize: GiveawayPrizePayload | null
  cards: GiveawayPrizeCard[]
  priceBand: PrizeCardPriceBand | null
  error: string | null
}
