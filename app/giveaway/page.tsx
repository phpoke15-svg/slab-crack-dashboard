import { GiveawayClient } from "@/components/giveaway-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Monthly Giveaway",
  description:
    "Earn free monthly giveaway entries by using Collectools. Free and premium tiers, mail-in AMOE available.",
  path: "/giveaway",
})

export default function GiveawayPage() {
  return <GiveawayClient />
}
