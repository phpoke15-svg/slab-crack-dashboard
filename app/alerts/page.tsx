import { AlertsTabClient } from "@/components/tab-views/alerts-tab-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Alerts",
  description: "PokeWatch Pokemon Center queue alerts and Walmart Restocks tracking in one place.",
  path: "/alerts",
})

export default function AlertsPage() {
  return (
    <main className="min-h-dvh bg-background">
      <AlertsTabClient />
    </main>
  )
}
