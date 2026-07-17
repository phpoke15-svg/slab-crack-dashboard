import type { Metadata } from "next"
import type { CatalogSearchHit } from "@/lib/db/cards-catalog"
import type { CardPriceRow } from "@/lib/pricing/types"
import { SEO_SITE_NAME } from "@/lib/seo"
import { getSiteUrl } from "@/lib/site-url"
import {
  buildCardSlug,
  buildSetSlug,
  cardPageUrl,
  formatCardNumberForSeo,
} from "@/lib/seo/card-slugs"

export type CardPseoContext = {
  card: CatalogSearchHit
  price: CardPriceRow | null
  soldCompCount: number
  setSlug: string
  cardSlug: string
}

export function resolveCardSlugs(card: CatalogSearchHit): { setSlug: string; cardSlug: string } {
  return {
    setSlug: buildSetSlug(card.setId, card.setName),
    cardSlug: buildCardSlug(card.name, card.number),
  }
}

export function buildCardSeoTitle(card: CatalogSearchHit): string {
  const number = formatCardNumberForSeo(card.number)
  const parts = [card.name, number, `(${card.setName})`].filter(Boolean)
  return `${parts.join(" ")} Value & Price Guide - ${SEO_SITE_NAME}`
}

export function buildCardSeoDescription(card: CatalogSearchHit): string {
  return `Check the current raw market price, recent eBay sold comps, and graded slab values (PSA 10, PSA 9) for ${card.name} from the ${card.setName} TCG expansion.`
}

export function buildCardPseoMetadata(ctx: CardPseoContext): Metadata {
  const { card, setSlug, cardSlug } = ctx
  const title = buildCardSeoTitle(card)
  const description = buildCardSeoDescription(card)
  const url = cardPageUrl(getSiteUrl(), setSlug, cardSlug)
  const image = card.imageUrl && !card.imageUrl.includes("placeholder") ? card.imageUrl : undefined

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SEO_SITE_NAME,
      title,
      description,
      url,
      locale: "en_US",
      ...(image ? { images: [{ url: image, alt: card.name }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
      },
    },
  }
}

export function buildCardProductJsonLd(ctx: CardPseoContext): Record<string, unknown> {
  const { card, price, soldCompCount, setSlug, cardSlug } = ctx
  const number = formatCardNumberForSeo(card.number)
  const url = cardPageUrl(getSiteUrl(), setSlug, cardSlug)
  const raw = price?.raw_price ?? card.rawPrice ?? null
  const psa10 = price?.psa10_price ?? null
  const lowPrice = raw && raw > 0 ? raw : undefined
  const highPrice = psa10 && psa10 > 0 ? psa10 : lowPrice
  const offerCount = soldCompCount > 0 ? soldCompCount : lowPrice ? 1 : undefined

  const offers =
    lowPrice && highPrice
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: lowPrice.toFixed(2),
          highPrice: highPrice.toFixed(2),
          ...(offerCount ? { offerCount } : {}),
          availability: "https://schema.org/InStock",
          url,
        }
      : undefined

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${card.name} (${card.setName}) ${number}`.trim(),
    image: card.imageUrl && !card.imageUrl.includes("placeholder") ? card.imageUrl : undefined,
    description: `Trading card valuation for ${card.name}.`,
    brand: {
      "@type": "Brand",
      name: "Pokémon TCG",
    },
    category: "Collectible Card Games",
    url,
    ...(offers ? { offers } : {}),
  }
}
