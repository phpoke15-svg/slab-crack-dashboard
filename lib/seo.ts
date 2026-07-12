import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"
import { LEGAL_CONTACT_EMAIL, LEGAL_SITE_NAME } from "@/lib/legal/config"

export const SEO_SITE_NAME = LEGAL_SITE_NAME

export const SEO_DEFAULT_TITLE = "CollecTools — Pokémon TCG Collector Toolkit"

export const SEO_DEFAULT_DESCRIPTION =
  "Free and Premium tools for Pokémon TCG collectors: SlabCrack graded arbitrage, SlabLab PSA 10 spreads, PokeMatch trading, CardLounge social feed, and PokeWatch Pokemon Center queue alerts."

export const SEO_KEYWORDS = [
  "Pokémon TCG",
  "Pokemon TCG tools",
  "PSA grading",
  "slab arbitrage",
  "Pokemon Center queue",
  "TCG trading",
  "PriceCharting",
  "PSA 10",
  "CollecTools",
  "SlabCrack",
  "PokeMatch",
  "SlabLab",
  "PokeWatch",
  "CardLounge",
] as const

type PageSeoInput = {
  /** Short title without the brand (template adds · CollecTools). */
  title: string
  description: string
  /** Path including leading slash, e.g. `/slabcrack`. Use `/` for home. */
  path: string
  noIndex?: boolean
  /** Use absolute title (no template) — for homepage. */
  absoluteTitle?: string
}

/** Shared per-page metadata: canonical, OG, Twitter. */
export function pageMetadata({
  title,
  description,
  path,
  noIndex,
  absoluteTitle,
}: PageSeoInput): Metadata {
  const base = getSiteUrl().replace(/\/$/, "")
  const url = path === "/" ? base : `${base}${path.startsWith("/") ? path : `/${path}`}`
  const ogTitle = absoluteTitle ?? `${title} · ${SEO_SITE_NAME}`

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    keywords: [...SEO_KEYWORDS],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SEO_SITE_NAME,
      title: ogTitle,
      description,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: false,
            googleBot: { index: false, follow: false },
          },
        }
      : {}),
  }
}

export function organizationJsonLd() {
  const base = getSiteUrl().replace(/\/$/, "")
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SEO_SITE_NAME,
    url: base,
    logo: `${base}/icon.svg`,
    email: LEGAL_CONTACT_EMAIL,
    description: SEO_DEFAULT_DESCRIPTION,
    sameAs: [] as string[],
  }
}

export function websiteJsonLd() {
  const base = getSiteUrl().replace(/\/$/, "")
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SEO_SITE_NAME,
    url: base,
    description: SEO_DEFAULT_DESCRIPTION,
    publisher: { "@type": "Organization", name: SEO_SITE_NAME, url: base },
  }
}

export function softwareApplicationJsonLd(opts: {
  name: string
  description: string
  path: string
  applicationCategory?: string
}) {
  const base = getSiteUrl().replace(/\/$/, "")
  const url = `${base}${opts.path}`
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    applicationCategory: opts.applicationCategory ?? "BusinessApplication",
    operatingSystem: "Web",
    url,
    description: opts.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier available; Premium and Pro plans on /pricing",
    },
    provider: {
      "@type": "Organization",
      name: SEO_SITE_NAME,
      url: base,
    },
  }
}
