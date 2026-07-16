import { redirect } from "next/navigation"
import { GiveawayClient } from "@/components/giveaway-client"
import { monthPeriod, utcTodayIso } from "@/lib/giveaway/constants"
import { getGiveawayPrizeCards } from "@/lib/giveaway/prize-cards"
import { getPrizeSnapshotForMonth, getPromotionEntryStats } from "@/lib/giveaway/service"
import type { GiveawayEntryPoolData, GiveawayPagePrizeData } from "@/lib/giveaway/types"
import { pageMetadata } from "@/lib/seo"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export const metadata = pageMetadata({
  title: "Monthly Giveaway",
  description:
    "Earn free monthly giveaway entries by using CollecTools. All account tiers eligible — cash prize paid via PayPal.",
  path: "/giveaway",
})

async function loadGiveawayPrizeData(): Promise<GiveawayPagePrizeData> {
  try {
    const snap = await getPrizeSnapshotForMonth(monthPeriod())
    const prize = {
      monthPeriod: snap.monthPeriod,
      snapshotAt: snap.snapshotAt,
      snapshotDate: utcTodayIso(),
      accountSnapshot: snap.accountSnapshot,
      prizePerAccountUsd: snap.prizePerAccountUsd,
      prizeArvUsd: snap.prizeArvUsd,
    }

    try {
      const { band, cards, usedLivePriceCharting } = await getGiveawayPrizeCards(snap.prizeArvUsd)
      return { prize, cards, priceBand: band, usedLivePriceCharting, error: null }
    } catch (cardError) {
      console.warn("[giveaway-page] prize cards failed:", cardError)
      return { prize, cards: [], priceBand: null, error: null }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load giveaway prize"
    return {
      prize: null,
      cards: [],
      priceBand: null,
      error: message,
    }
  }
}

async function loadGiveawayEntryPool(): Promise<GiveawayEntryPoolData> {
  const period = monthPeriod()
  try {
    const stats = await getPromotionEntryStats(period)
    return {
      monthPeriod: stats.monthPeriod,
      totalEntries: stats.totalEntries,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load entry count"
    return {
      monthPeriod: period,
      totalEntries: 0,
      error: message,
    }
  }
}

export default async function GiveawayPage() {
  const auth = await requireUser()
  if (!auth.ok) redirect(`/sign-in?next=${encodeURIComponent("/giveaway")}`)

  const [prizeData, entryPool] = await Promise.all([loadGiveawayPrizeData(), loadGiveawayEntryPool()])

  return <GiveawayClient prizeData={prizeData} entryPool={entryPool} />
}
