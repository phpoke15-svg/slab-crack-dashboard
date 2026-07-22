import { redirect } from "next/navigation"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { LoungeFeed } from "@/components/lounge-feed"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { pageMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"

export const metadata = pageMetadata({
  title: "CardLounge",
  description:
    "Collector social feed for Pokémon TCG — short posts, photos, videos, follows, likes, and replies.",
  path: "/card-lounge",
  noIndex: true,
})

/** CardLounge — Twitter-like social feed for every signed-in collector. */
export default async function CardLoungePage() {
  const auth = await requireUser()
  if (!auth.ok) redirect(`/sign-in?next=${encodeURIComponent("/card-lounge")}`)

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.48_0.12_25_/_0.12),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="CardLounge · collector feed" />
            <h1 className="mt-5 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              CardLounge
            </h1>
          </div>
          <SiteAuthButton className="shrink-0" />
        </header>

        <LoungeFeed />

        <SiteFooter className="mt-12" />
      </div>
    </main>
  )
}
