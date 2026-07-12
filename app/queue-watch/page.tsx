import { QueueWatchClient } from "@/components/queue-watch-client"
import { JsonLd } from "@/components/seo/json-ld"
import { pageMetadata, softwareApplicationJsonLd } from "@/lib/seo"

const description =
  "Queue Watch sends instant alerts when the Pokemon Center virtual queue goes live so you can check out sealed Pokémon TCG products faster."

export const metadata = pageMetadata({
  title: "Queue Watch",
  description,
  path: "/queue-watch",
})

export default function QueueWatchPage() {
  return (
    <main className="min-h-dvh bg-background">
      <JsonLd
        data={softwareApplicationJsonLd({
          name: "Queue Watch",
          description,
          path: "/queue-watch",
        })}
      />
      <QueueWatchClient />
    </main>
  )
}
