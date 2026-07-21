import { ResearchLandingClient } from "@/components/research-landing-client"
import { HomeSeoIntro } from "@/components/seo/home-seo-intro"
import { JsonLd } from "@/components/seo/json-ld"
import { COLLECTOOLS } from "@/lib/collectools-tools"
import { itemListJsonLd, pageMetadata, SEO_DEFAULT_DESCRIPTION, SEO_DEFAULT_TITLE } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Research",
  absoluteTitle: SEO_DEFAULT_TITLE,
  description: SEO_DEFAULT_DESCRIPTION,
  path: "/",
})

export default function Page() {
  return (
    <main className="min-h-dvh bg-background">
      <JsonLd
        data={itemListJsonLd({
          name: "CollecTools — Pokémon TCG collector tools",
          description: SEO_DEFAULT_DESCRIPTION,
          items: COLLECTOOLS.map((tool) => ({
            name: tool.name,
            url: tool.href,
            description: tool.blurb,
          })),
        })}
      />
      <HomeSeoIntro />
      <ResearchLandingClient />
    </main>
  )
}
