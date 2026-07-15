import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"
import { LEGAL_CONTACT_EMAIL, LEGAL_SITE_NAME } from "@/lib/legal/config"
import {
  ANDROID_PACKAGE,
  APP_STORE_SAME_AS,
  IOS_APP_STORE_ID,
  IOS_BUNDLE_ID,
  iosAppStoreUrl,
  playStoreUrl,
} from "@/lib/app-stores"

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
      locale: "en_US",
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

/** Smart App Banner meta value for iOS Safari. */
export function appleItunesAppMetaContent(): string | null {
  if (!IOS_APP_STORE_ID) return null
  return `app-id=${IOS_APP_STORE_ID}, app-argument=${getSiteUrl().replace(/\/$/, "")}/`
}

export function organizationJsonLd() {
  const base = getSiteUrl().replace(/\/$/, "")
  const sameAs = [...APP_STORE_SAME_AS]
  const social = process.env.NEXT_PUBLIC_SOCIAL_PROFILE_URLS?.trim()
  if (social) {
    for (const url of social.split(",").map((item) => item.trim()).filter(Boolean)) {
      sameAs.push(url)
    }
  }
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SEO_SITE_NAME,
    url: base,
    logo: `${base}/icon.svg`,
    email: LEGAL_CONTACT_EMAIL,
    description: SEO_DEFAULT_DESCRIPTION,
    sameAs,
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
      availability: "https://schema.org/InStock",
      url: `${base}/pricing`,
      description: "Free tier available; Premium and Pro plans on /pricing",
    },
    provider: {
      "@type": "Organization",
      name: SEO_SITE_NAME,
      url: base,
    },
  }
}

export function mobileApplicationJsonLd(opts?: {
  description?: string
}) {
  const base = getSiteUrl().replace(/\/$/, "")
  const description =
    opts?.description ??
    "CollecTools mobile app for Pokémon TCG collectors — SlabCrack, SlabLab, PokeMatch, and PokeWatch Pokemon Center queue alerts with push notifications."

  return {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: SEO_SITE_NAME,
    operatingSystem: "iOS, Android",
    applicationCategory: "BusinessApplication",
    description,
    url: base,
    installUrl: [iosAppStoreUrl(), playStoreUrl()],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${base}/pricing`,
    },
    provider: {
      "@type": "Organization",
      name: SEO_SITE_NAME,
      url: base,
    },
    softwareVersion: process.env.NEXT_PUBLIC_APP_VERSION?.trim() || undefined,
    identifier: [
      { "@type": "PropertyValue", name: "iOS bundleId", value: IOS_BUNDLE_ID },
      { "@type": "PropertyValue", name: "Android package", value: ANDROID_PACKAGE },
    ],
  }
}

export function itemListJsonLd(opts: {
  name: string
  description?: string
  items: Array<{ name: string; url: string; description?: string }>
}) {
  const base = getSiteUrl().replace(/\/$/, "")
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    description: opts.description,
    itemListElement: opts.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url.startsWith("http") ? item.url : `${base}${item.url}`,
      ...(item.description ? { description: item.description } : {}),
    })),
  }
}

export function faqPageJsonLd(
  entries: Array<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  }
}

export function breadcrumbJsonLd(
  crumbs: Array<{ name: string; path: string }>,
) {
  const base = getSiteUrl().replace(/\/$/, "")
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.path === "/" ? base : `${base}${crumb.path}`,
    })),
  }
}

export function pricingOfferCatalogJsonLd(description: string) {
  const base = getSiteUrl().replace(/\/$/, "")
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: `${SEO_SITE_NAME} plans`,
    url: `${base}/pricing`,
    description,
    itemListElement: [
      {
        "@type": "Offer",
        name: "Premium",
        price: "4.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${base}/pricing`,
        description: "Full SlabCrack feed and ad-free browsing",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "9.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${base}/pricing`,
        description: "Premium plus Pokemon Center PokeWatch alerts",
      },
    ],
  }
}
