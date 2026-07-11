import type { Metadata } from "next"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { Psa10SpreadScanner } from "@/components/psa10-spread-scanner"

export const metadata: Metadata = {
  title: "PSA 10 Spread Scanner — CollecTools",
  description:
    "Rank modern TCG cards by PSA 10 gross spread, graded multiplier, and probability-weighted submission ROI.",
}

export default function Psa10ScannerPage() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_155_/_0.14),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="PSA 10 Spread · multiplier scanner" />
            <h1 className="mt-5 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              PSA 10 Spread Ratio &amp; Multiplier Scanner
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Scan modern sets for the widest raw → PSA 10 gaps, then rank by gross spread, graded
              multiplier, or gem-rate-weighted submission yield.
            </p>
          </div>
          <SiteAuthButton className="shrink-0" />
        </header>

        <Psa10SpreadScanner />

        <SiteFooter className="mt-12" />
      </div>
    </div>
  )
}
