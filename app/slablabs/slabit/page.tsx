import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Camera } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { Psa10SpreadScanner } from "@/components/psa10-spread-scanner"
import { JsonLd } from "@/components/seo/json-ld"
import { pageMetadata, breadcrumbJsonLd, softwareApplicationJsonLd } from "@/lib/seo"
import { SLABIT_HREF, SLABLABS_HREF } from "@/lib/slabs-labs-routes"

const description =
  "SlabIt ranks the top 100 Pokémon TCG cards from the past five years by PSA 10 gross spread, graded multiplier, and submission ROI using live market comps refreshed daily."

export const metadata: Metadata = pageMetadata({
  title: "SlabIt",
  description,
  path: SLABIT_HREF,
})

export default function SlabItPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      <JsonLd
        data={[
          softwareApplicationJsonLd({
            name: "SlabIt",
            description,
            path: SLABIT_HREF,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "SlabLabs", path: SLABLABS_HREF },
            { name: "SlabIt", path: SLABIT_HREF },
          ]),
        ]}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_155_/_0.14),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="SlabIt · PSA 10 spread scanner" />
            <h1 className="mt-5 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              SlabIt
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={SLABLABS_HREF}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                Back to SlabLabs
              </Link>
              <Link
                href={`${SLABIT_HREF}/scan`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
              >
                <Camera className="size-3.5" aria-hidden />
                Point & Scan
              </Link>
            </div>
          </div>
          <SiteAuthButton />
        </header>

        <Psa10SpreadScanner />

        <SiteFooter className="mt-12" />
      </div>
    </main>
  )
}
