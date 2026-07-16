import { redirect } from "next/navigation"
import { GiveawayClient } from "@/components/giveaway-client"
import { requireGiveawayAccess } from "@/lib/giveaway/access"
import { monthPeriod, utcTodayIso } from "@/lib/giveaway/constants"
import { getGiveawayPrizeCards } from "@/lib/giveaway/prize-cards"
import { getPrizeSnapshotForMonth } from "@/lib/giveaway/service"
import type { GiveawayPagePrizeData } from "@/lib/giveaway/types"
import { pageMetadata } from "@/lib/seo"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

export const metadata = pageMetadata({
  title: "Monthly Giveaway",
  description:
    "Earn free monthly giveaway entries by using Collectools. Free and premium tiers, mail-in AMOE available.",
  path: "/giveaway",
  noIndex: true,
})

async function loadGiveawayPrizeData(): Promise<GiveawayPagePrizeData> {
  try {
    const snap = await getPrizeSnapshotForMonth(monthPeriod())
    const { band, cards } = await getGiveawayPrizeCards(snap.prizeArvUsd)

    return {
      prize: {
        monthPeriod: snap.monthPeriod,
        snapshotAt: snap.snapshotAt,
        snapshotDate: utcTodayIso(),
        accountSnapshot: snap.accountSnapshot,
        prizePerAccountUsd: snap.prizePerAccountUsd,
        prizeArvUsd: snap.prizeArvUsd,
      },
      cards,
      priceBand: band,
      error: null,
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

/** Supreme-only preview until the giveaway is ready for public launch. */
export default async function GiveawayPage() {
  const auth = await requireUser()
  if (!auth.ok) redirect(`/sign-in?next=${encodeURIComponent("/giveaway")}`)

  const access = await requireGiveawayAccess(auth.user.id)
  if (!access.ok) redirect("/")

  const prizeData = await loadGiveawayPrizeData()

  return <GiveawayClient prizeData={prizeData} />
}
