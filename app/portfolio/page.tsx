import type { Metadata } from "next"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { AiPortfolioTracker } from "@/components/portfolio/ai-portfolio-tracker"
import { pageMetadata } from "@/lib/seo"

const description =
  "Weekly AI-ranked Pokémon TCG purchase opportunities with confidence scores, price targets, and historical portfolio performance tracking."

export const metadata: Metadata = pageMetadata({
  title: "AI Portfolio Tracker",
  description,
  path: "/portfolio",
})

export default function PortfolioPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.48_0.12_250_/_0.12),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/labs" size="lg" subtitle="Labs · AI Portfolio Tracker" />
            <h1 className="mt-5 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Top Weekly Purchase Opportunities
            </h1>
          </div>
          <SiteAuthButton className="shrink-0" />
        </header>

        <AiPortfolioTracker />

        <SiteFooter className="mt-12" />
      </div>
    </main>
  )
}
