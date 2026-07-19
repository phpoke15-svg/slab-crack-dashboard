import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { SlabPopClient } from "@/components/slabpop-client"
import { JsonLd } from "@/components/seo/json-ld"
import { pageMetadata, breadcrumbJsonLd, softwareApplicationJsonLd } from "@/lib/seo"
import { SLABLABS_HREF, SLABPOP_HREF } from "@/lib/slabs-labs-routes"

const description =
  "SlabPop filters graded Pokémon TCG cards by population report, price range, and grade so you can hunt low-pop slabs in your budget."

export const metadata: Metadata = pageMetadata({
  title: "SlabPop",
  description,
  path: SLABPOP_HREF,
})

export default function SlabPopPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      <JsonLd
        data={[
          softwareApplicationJsonLd({
            name: "SlabPop",
            description,
            path: SLABPOP_HREF,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "SlabLabs", path: SLABLABS_HREF },
            { name: "SlabPop", path: SLABPOP_HREF },
          ]),
        ]}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_155_/_0.14),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="SlabPop · population filters" />
            <h1 className="mt-5 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              SlabPop
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Filter graded cards by pop report ceiling, price band, and grade. The non-linear pop
              slider gives fine control for rare low-pop hunts.
            </p>
            <Link
              href={SLABLABS_HREF}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to SlabLabs
            </Link>
          </div>
          <SiteAuthButton />
        </header>

        <SlabPopClient />

        <SiteFooter className="mt-12" />
      </div>
    </main>
  )
}
