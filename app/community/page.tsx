import { CommunityTabClient } from "@/components/tab-views/community-tab-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Community",
  description: "PokeMatch binder trading and CardLounge social feed for Pokémon TCG collectors.",
  path: "/community",
})

export default function CommunityPage() {
  return (
    <main className="min-h-dvh bg-background">
      <CommunityTabClient />
    </main>
  )
}
