import { QueueWatchClient } from "@/components/queue-watch-client"

export const metadata = {
  title: "Queue Watch — CollecTools",
  description: "Instant alerts when the Pokemon Center virtual queue goes live.",
}

export default function QueueWatchPage() {
  return (
    <div className="min-h-dvh bg-background">
      <QueueWatchClient />
    </div>
  )
}
