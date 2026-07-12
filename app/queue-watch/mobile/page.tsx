import { QueueWatchMobileClient } from "@/components/queue-watch-mobile-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Queue Watch Mobile",
  description: "Install Queue Watch mobile alerts for Pokemon Center with Expo and ntfy push.",
  path: "/queue-watch/mobile",
  noIndex: true,
})

export default function QueueWatchMobilePage() {
  return (
    <main className="min-h-dvh bg-background">
      <QueueWatchMobileClient />
    </main>
  )
}
