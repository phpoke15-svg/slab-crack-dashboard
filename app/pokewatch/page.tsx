import { QueueWatchClient } from "@/components/queue-watch-client"
import { JsonLd } from "@/components/seo/json-ld"
import { pageMetadata, softwareApplicationJsonLd } from "@/lib/seo"

const description =
  "PokeWatch sends instant alerts when the Pokemon Center virtual queue goes live so you can check out sealed Pokémon TCG products faster."

export const metadata = pageMetadata({
  title: "PokeWatch",
  description,
  path: "/pokewatch",
})

export default function PokeWatchPage() {
  return (
    <main className="min-h-dvh bg-background">
      <JsonLd
        data={softwareApplicationJsonLd({
          name: "PokeWatch",
          description,
          path: "/pokewatch",
        })}
      />
      <QueueWatchClient />
    </main>
  )
}
