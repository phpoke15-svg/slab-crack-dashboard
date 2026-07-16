import { redirect } from "next/navigation"
import { GiveawayClient } from "@/components/giveaway-client"
import { requireGiveawayAccess } from "@/lib/giveaway/access"
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

/** Supreme-only preview until the giveaway is ready for public launch. */
export default async function GiveawayPage() {
  const auth = await requireUser()
  if (!auth.ok) redirect(`/sign-in?next=${encodeURIComponent("/giveaway")}`)

  const access = await requireGiveawayAccess(auth.user.id)
  if (!access.ok) redirect("/")

  return <GiveawayClient />
}
