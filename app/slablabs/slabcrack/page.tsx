import { SlabDashboard } from "@/components/slab-dashboard"
import { JsonLd } from "@/components/seo/json-ld"
import { breadcrumbJsonLd, pageMetadata, softwareApplicationJsonLd } from "@/lib/seo"
import { SLABCRACK_HREF, SLABLABS_HREF } from "@/lib/slabs-labs-routes"

const description =
  "Find undervalued graded Pokémon TCG cards. SlabCrack compares raw vs PSA slab prices so you can spot arbitrage and crack opportunities."

export const metadata = pageMetadata({
  title: "SlabCrack",
  description,
  path: SLABCRACK_HREF,
})

export default function SlabCrackPage() {
  return (
    <main className="min-h-dvh bg-background">
      <JsonLd
        data={[
          softwareApplicationJsonLd({
            name: "SlabCrack",
            description,
            path: SLABCRACK_HREF,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "SlabLabs", path: SLABLABS_HREF },
            { name: "SlabCrack", path: SLABCRACK_HREF },
          ]),
        ]}
      />
      <SlabDashboard />
    </main>
  )
}
