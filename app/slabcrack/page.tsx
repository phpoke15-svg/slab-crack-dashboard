import { SlabDashboardClient } from "@/components/slab-dashboard-client"
import { JsonLd } from "@/components/seo/json-ld"
import { ToolSeoFooter, ToolSeoIntro } from "@/components/seo/tool-seo-intro"
import { pageMetadata, softwareApplicationJsonLd } from "@/lib/seo"

const description =
  "Find undervalued graded Pokémon TCG cards. SlabCrack compares raw vs PSA slab prices so you can spot arbitrage and crack opportunities."

export const metadata = pageMetadata({
  title: "SlabCrack",
  description,
  path: "/slabcrack",
})

export default function SlabCrackPage() {
  return (
    <main className="min-h-dvh bg-background">
      <JsonLd
        data={softwareApplicationJsonLd({
          name: "SlabCrack",
          description,
          path: "/slabcrack",
        })}
      />
      <ToolSeoIntro
        title="SlabCrack"
        description={description}
        bullets={[
          "Compare raw market prices against PSA graded slab quotes",
          "Browse live deficit opportunities for Pokémon TCG singles",
          "Starter: 10 mid-ranked cards · Premium: top 100 · Pro: full feed + search",
        ]}
        related={[
          { href: "/slablab", label: "SlabLab" },
          { href: "/binder", label: "PokeMatch" },
          { href: "/pricing", label: "Pricing" },
        ]}
      />
      <SlabDashboardClient />
      <ToolSeoFooter />
    </main>
  )
}
