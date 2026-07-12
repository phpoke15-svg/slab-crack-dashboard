import { TradeBinderClient } from "@/components/trade-binder-client"
import { JsonLd } from "@/components/seo/json-ld"
import { ToolSeoFooter, ToolSeoIntro } from "@/components/seo/tool-seo-intro"
import { pageMetadata, softwareApplicationJsonLd } from "@/lib/seo"

const description =
  "PokeMatch helps Pokémon TCG collectors build binders, find trade matches, and complete swaps with chat and reviews."

export const metadata = pageMetadata({
  title: "PokeMatch",
  description,
  path: "/binder",
})

export default function BinderPage() {
  return (
    <main className="min-h-dvh bg-background">
      <JsonLd
        data={softwareApplicationJsonLd({
          name: "PokeMatch",
          description,
          path: "/binder",
          applicationCategory: "SocialNetworkingApplication",
        })}
      />
      <ToolSeoIntro
        title="PokeMatch"
        description={description}
        bullets={[
          "List cards you have and cards you want",
          "Get matched with collectors for fair trades",
          "Chat, complete swaps, and leave reviews",
        ]}
        related={[
          { href: "/slabcrack", label: "SlabCrack" },
          { href: "/slablab", label: "SlabLab" },
          { href: "/pricing", label: "Pricing" },
        ]}
      />
      <TradeBinderClient />
      <ToolSeoFooter />
    </main>
  )
}
