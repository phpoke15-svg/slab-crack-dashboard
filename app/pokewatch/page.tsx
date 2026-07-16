import { QueueWatchClient } from "@/components/queue-watch-client"
import { AppStoreBadges } from "@/components/seo/app-store-badges"
import { JsonLd } from "@/components/seo/json-ld"
import { ToolSeoFooter, ToolSeoIntro } from "@/components/seo/tool-seo-intro"
import { POKEWATCH_FAQ } from "@/lib/seo-faq"
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  mobileApplicationJsonLd,
  pageMetadata,
  softwareApplicationJsonLd,
} from "@/lib/seo"

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
        data={[
          softwareApplicationJsonLd({
            name: "PokeWatch",
            description,
            path: "/pokewatch",
          }),
          mobileApplicationJsonLd({
            description:
              "CollecTools mobile app with PokeWatch push alerts for Pokemon Center queue drops.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "PokeWatch", path: "/pokewatch" },
          ]),
          faqPageJsonLd([...POKEWATCH_FAQ]),
        ]}
      />
      <ToolSeoIntro
        title="PokeWatch"
        description={description}
        disclaimer="Use at your own risk."
        bullets={[
          "24/7 monitoring for Pokemon Center virtual queue drops",
          "Browser and phone push alerts when the queue goes live",
          "Included with CollecTools Pro — bookmarklet syncs with the mobile app",
        ]}
        related={[
          { href: "/pricing", label: "Pricing" },
          { href: "/slabcrack", label: "SlabCrack" },
          { href: "/pokewatch/mobile", label: "Mobile install" },
        ]}
      />
      <div className="border-b border-border bg-card/20 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Get CollecTools on your phone — PokeWatch alerts, SlabCrack, SlabLab, and PokeMatch in
            one app.
          </p>
          <AppStoreBadges />
        </div>
      </div>
      <QueueWatchClient />
      <ToolSeoFooter />
    </main>
  )
}
