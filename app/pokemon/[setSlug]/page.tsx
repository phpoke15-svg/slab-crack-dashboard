import Link from "next/link"
import { notFound } from "next/navigation"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { JsonLd } from "@/components/seo/json-ld"
import { SiteFooter } from "@/components/legal/site-footer"
import { listPseoSets, listSetCards } from "@/lib/db/cards-pseo"
import { cardPagePath, formatCardNumberForSeo } from "@/lib/seo/card-slugs"
import { breadcrumbJsonLd, itemListJsonLd, pageMetadata } from "@/lib/seo"

export const revalidate = 3600

type PageProps = {
  params: Promise<{ setSlug: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { setSlug } = await params
  const sets = await listPseoSets()
  const set = sets.find((row) => row.setSlug === setSlug.trim().toLowerCase())
  if (!set) {
    return { title: "Set Not Found", robots: { index: false, follow: false } }
  }

  const description = `Browse ${set.setName} Pokémon TCG card prices — raw market values, PSA 9 and PSA 10 graded comps, and links to SlabCrack arbitrage on CollecTools.`

  return pageMetadata({
    title: `${set.setName} Card Prices`,
    description,
    path: `/pokemon/${set.setSlug}`,
  })
}

export default async function PokemonSetPage({ params }: PageProps) {
  const { setSlug } = await params
  const normalized = setSlug.trim().toLowerCase()
  const sets = await listPseoSets()
  const set = sets.find((row) => row.setSlug === normalized)
  if (!set) notFound()

  const cards = await listSetCards(normalized)
  const description = `Price guides for ${set.cardCount} cards in ${set.setName}.`

  return (
    <main className="min-h-dvh bg-background">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Pokémon TCG Sets", path: "/pokemon" },
            { name: set.setName, path: `/pokemon/${set.setSlug}` },
          ]),
          itemListJsonLd({
            name: `${set.setName} card price guides`,
            description,
            items: cards.slice(0, 50).map((card) => ({
              name: card.name,
              url: cardPagePath(set.setSlug, card.cardSlug),
            })),
          }),
        ]}
      />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <Link href="/pokemon">
            <CollecToolsBrand subtitle="Set price guide" />
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">{set.setName}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Also try{" "}
            <Link href="/slablabs/slabcrack" className="font-medium text-primary hover:underline">
              SlabCrack
            </Link>{" "}
            for graded arbitrage and{" "}
            <Link href="/slablabs/slabit" className="font-medium text-primary hover:underline">
              SlabIt
            </Link>{" "}
            for PSA 10 submission ROI.
          </p>
        </header>

        {cards.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No indexed cards for this set yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card/40">
            {cards.map((card) => (
              <li key={card.cardSlug}>
                <Link
                  href={cardPagePath(set.setSlug, card.cardSlug)}
                  className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-card"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{card.name}</span>
                    {card.number ? (
                      <span className="ml-2 text-muted-foreground">
                        {formatCardNumberForSeo(card.number)}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-primary">Price guide →</span>
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
