import Link from "next/link"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { JsonLd } from "@/components/seo/json-ld"
import { SiteFooter } from "@/components/legal/site-footer"
import { listPseoSets } from "@/lib/db/cards-pseo"
import { breadcrumbJsonLd, itemListJsonLd, pageMetadata } from "@/lib/seo"

export const revalidate = 3600

const description =
  "Browse Pokémon TCG sets with card price guides, raw and PSA graded values, and market snapshots on CollecTools."

export const metadata = pageMetadata({
  title: "Pokémon TCG Card Price Guides",
  description,
  path: "/pokemon",
})

export default async function PokemonSetsIndexPage() {
  const sets = await listPseoSets()

  return (
    <main className="min-h-dvh bg-background">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Pokémon TCG Sets", path: "/pokemon" },
          ]),
          itemListJsonLd({
            name: "Pokémon TCG set price guides",
            description,
            items: sets.slice(0, 100).map((set) => ({
              name: set.setName,
              url: `/pokemon/${set.setSlug}`,
              description: `${set.cardCount.toLocaleString("en-US")} cards with price data`,
            })),
          }),
        ]}
      />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <Link href="/">
            <CollecToolsBrand subtitle="Pokémon TCG price guides" />
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Pokémon TCG card price guides
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </header>

        {sets.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Set price guides are loading. Check back soon or open{" "}
            <Link href="/slablabs" className="font-medium text-primary hover:underline">
              SlabLabs
            </Link>{" "}
            for live arbitrage tools.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {sets.map((set) => (
              <li key={set.setSlug}>
                <Link
                  href={`/pokemon/${set.setSlug}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-card"
                >
                  <span className="font-medium text-foreground">{set.setName}</span>
                  <span className="text-xs text-muted-foreground">{set.cardCount} cards</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <SiteFooter className="mt-12" />
      </div>
    </main>
  )
}
