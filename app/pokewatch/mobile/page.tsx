import { QueueWatchMobileClient } from "@/components/queue-watch-mobile-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "PokeWatch Mobile",
  description: "Install PokeWatch mobile alerts for Pokemon Center with Expo and ntfy push.",
  path: "/pokewatch/mobile",
  noIndex: true,
})

export default function PokeWatchMobilePage() {
  return (
    <main className="min-h-dvh bg-background">
      <QueueWatchMobileClient />
    </main>
  )
}
