import { SlabDashboard } from "@/components/slab-dashboard"
import { JsonLd } from "@/components/seo/json-ld"
import { ToolSeoFooter, ToolSeoIntro } from "@/components/seo/tool-seo-intro"
import { SLABCRACK_FAQ } from "@/lib/seo-faq"
import { breadcrumbJsonLd, faqPageJsonLd, pageMetadata, softwareApplicationJsonLd } from "@/lib/seo"
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
          faqPageJsonLd([...SLABCRACK_FAQ]),
        ]}
      />
      <ToolSeoIntro
        title="SlabCrack — graded slab arbitrage"
        description={description}
        bullets={[
          "Live feed of raw vs PSA slab price gaps",
          "Sort by dollar or percent deficit",
          "Watchlist, save-for-later folders, and camera scan",
        ]}
        related={[
          { href: SLABLABS_HREF, label: "SlabLabs" },
          { href: "/slablabs/slabit", label: "SlabIt" },
          { href: "/pricing", label: "Pricing" },
        ]}
      />
      <SlabDashboard />
      <ToolSeoFooter />
    </main>
  )
}
