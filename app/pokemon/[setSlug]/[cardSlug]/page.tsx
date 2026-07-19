import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardAppFunnelBanner } from "@/components/seo/card-app-funnel-banner"
import { JsonLd } from "@/components/seo/json-ld"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { loadCardPseoPageData } from "@/lib/db/cards-pseo"
import { formatCardNumberForSeo } from "@/lib/seo/card-slugs"
import { buildCardPseoMetadata, buildCardProductJsonLd } from "@/lib/seo/card-pseo"

export const revalidate = 3600

type PageProps = {
  params: Promise<{ setSlug: string; cardSlug: string }>
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—"
  return `$${value.toFixed(2)}`
}

export async function generateMetadata({ params }: PageProps) {
  const { setSlug, cardSlug } = await params
  const data = await loadCardPseoPageData(setSlug, cardSlug)
  if (!data) {
    return { title: "Card Not Found", robots: { index: false, follow: false } }
  }
  return buildCardPseoMetadata(data)
}

export default async function PokemonCardPseoPage({ params }: PageProps) {
  const { setSlug, cardSlug } = await params
  const data = await loadCardPseoPageData(setSlug, cardSlug)
  if (!data) notFound()

  const { card, price, soldCompCount } = data
  const number = formatCardNumberForSeo(card.number)
  const jsonLd = buildCardProductJsonLd(data)

  const rawPrice = price?.raw_price ?? card.rawPrice ?? null
  const psa9 = price?.psa9_price ?? null
  const psa10 = price?.psa10_price ?? null

  return (
    <>
      <JsonLd data={jsonLd} />
      <CardAppFunnelBanner cardId={card.id} setSlug={setSlug} cardSlug={cardSlug} />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-8">
          <Link href="/" className="inline-block">
            <CollecToolsBrand subtitle="Card price guide" />
          </Link>
        </header>

        <article className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="relative mx-auto aspect-[2.5/3.5] w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-muted shadow-lg">
            <Image
              src={card.imageUrl || "/placeholder.svg"}
              alt={card.name}
              fill
              sizes="(max-width: 768px) 80vw, 280px"
              className="object-contain p-2"
              priority
            />
          </div>

          <div>
            <p className="text-sm font-medium text-primary">{card.setName}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {card.name} {number}
            </h1>
            {card.japaneseName ? (
              <p className="mt-1 text-sm text-muted-foreground">{card.japaneseName}</p>
            ) : null}
            {card.rarity ? (
              <p className="mt-2 text-sm text-muted-foreground">{card.rarity}</p>
            ) : null}

            <section className="mt-6 rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Market snapshot
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Raw</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums">{formatUsd(rawPrice)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">PSA 9</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums">{formatUsd(psa9)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">PSA 10</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums">{formatUsd(psa10)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sold comps (30d)</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums">{soldCompCount || "—"}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Prices refresh on demand and via nightly sync. Open the CollecTools app to track this
                card in your portfolio and enter daily giveaways.
              </p>
            </section>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/binder"
                className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium hover:bg-accent"
              >
                Open PokeMatch Binder
              </Link>
              <Link
                href="/slablabs"
                className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium hover:bg-accent"
              >
                Check Slab Arbitrage
              </Link>
            </div>
          </div>
        </article>
      </main>
    </>
  )
}
