import type { Metadata } from "next"
import Link from "next/link"
import { Camera } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { Psa10SpreadScanner } from "@/components/psa10-spread-scanner"
import { JsonLd } from "@/components/seo/json-ld"
import { pageMetadata, softwareApplicationJsonLd } from "@/lib/seo"

const description =
  "SlabLab ranks the top 200 Pokémon TCG cards by PSA 10 gross spread, graded multiplier, and probability-weighted submission ROI using live market comps."

export const metadata: Metadata = pageMetadata({
  title: "SlabLab",
  description,
  path: "/slablab",
})

export default function SlabLabPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      <JsonLd
        data={softwareApplicationJsonLd({
          name: "SlabLab",
          description,
          path: "/slablab",
        })}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_155_/_0.14),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="SlabLab · PSA 10 spread scanner" />
            <h1 className="mt-5 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              SlabLab
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Top 200 PSA 10 submission candidates from live market comps. Tap a card for spread,
              multiplier, and grading-cost breakdown — or scan a card to open ROI instantly.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/slablab/scan"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
            >
              <Camera className="size-3.5" aria-hidden />
              Scan
            </Link>
            <SiteAuthButton />
          </div>
        </header>

        <Psa10SpreadScanner />

        <SiteFooter className="mt-12" />
      </div>
    </main>
  )
}
