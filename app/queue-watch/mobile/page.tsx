import { QueueWatchMobileClient } from "@/components/queue-watch-mobile-client"

export const metadata = {
  title: "Queue Watch Mobile — CollecTools",
  description: "Mobile Pokemon Center queue alerts with Expo and ntfy push.",
}

export default function QueueWatchMobilePage() {
  return (
    <div className="min-h-dvh bg-background">
      <QueueWatchMobileClient />
    </div>
  )
}
