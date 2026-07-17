import type { PrizeSnapshot } from "@/lib/giveaway/prize-snapshot"
import type {
  GiveawayPrizeCard,
  GiveawayPrizeCardMatchMode,
  PrizeCardPriceBand,
} from "@/lib/giveaway/prize-cards"

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
  usedLivePriceCharting?: boolean
  matchMode?: GiveawayPrizeCardMatchMode
  error: string | null
}

export type GiveawayEntryPoolData = {
  monthPeriod: string
  totalEntries: number
  error: string | null
}
