import type { Metadata } from "next"
import { Suspense } from "react"
import { PricingClient } from "@/components/pricing-client"
import { JsonLd } from "@/components/seo/json-ld"
import { pageMetadata, SEO_SITE_NAME } from "@/lib/seo"
import { getSiteUrl } from "@/lib/site-url"

const description =
  "CollecTools pricing: Premium from $4.99/mo for top 100 SlabCrack + SlabLab boards ad-free, Pro from $9.99/mo for full feeds, search, and Pokemon Center PokeWatch. 7-day free trial."

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description,
  path: "/pricing",
})

export default function PricingPage() {
  const base = getSiteUrl().replace(/\/$/, "")
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Loading plans…</p>
        </div>
      }
    >
      <JsonLd
        data={{
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
              description: "Top 100 SlabCrack + SlabLab boards and ad-free browsing",
            },
            {
              "@type": "Offer",
              name: "Pro",
              price: "9.99",
              priceCurrency: "USD",
              description: "Premium plus full feeds, search, and Pokemon Center PokeWatch",
            },
          ],
        }}
      />
      <PricingClient />
    </Suspense>
  )
}
