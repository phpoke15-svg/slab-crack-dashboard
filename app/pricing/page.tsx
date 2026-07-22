import type { Metadata } from "next"
import { Suspense } from "react"
import { PricingClient } from "@/components/pricing-client"
import { PricingTierOverview } from "@/components/pricing-tier-overview"
import { AppStoreBadges } from "@/components/seo/app-store-badges"
import { JsonLd } from "@/components/seo/json-ld"
import { PRICING_FAQ } from "@/lib/seo-faq"
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  pageMetadata,
  pricingOfferCatalogJsonLd,
} from "@/lib/seo"

const description =
  "CollecTools pricing: Premium from $4.99/mo for full SlabCrack and ad-free browsing, Pro from $9.99/mo for Pokemon Center PokeWatch alerts. All tiers earn monthly giveaway entries (cash via PayPal). 7-day free trial."

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description,
  path: "/pricing",
})

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Loading plans…</p>
        </div>
      }
    >
      <JsonLd
        data={[
          pricingOfferCatalogJsonLd(description),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          faqPageJsonLd([...PRICING_FAQ]),
        ]}
      />
      <section className="border-b border-border bg-card/30 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Also on mobile</p>
            <AppStoreBadges />
          </div>
        </div>
      </section>
      <PricingTierOverview />
      <PricingClient />
    </Suspense>
  )
}
