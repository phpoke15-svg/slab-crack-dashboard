import { redirect } from "next/navigation"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { LoungeFeed } from "@/components/lounge-feed"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser } from "@/lib/billing/stripe"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "CardLounge",
  description: "Supreme-only collector feed — short posts, media, follows, and replies.",
  robots: { index: false, follow: false },
}

/** CardLounge — Twitter-like social feed for Supreme accounts. */
export default async function CardLoungePage() {
  const auth = await requireUser()
  if (!auth.ok) redirect(`/sign-in?next=${encodeURIComponent("/card-lounge")}`)
  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) redirect("/")

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.48_0.12_25_/_0.12),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="CardLounge · Supreme preview" />
            <h1 className="mt-5 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              CardLounge
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A private collector feed for Supreme — post photos, videos, follow, like, and reply.
              Not indexed and not on the public hub.
            </p>
          </div>
          <SiteAuthButton className="shrink-0" />
        </header>

        <LoungeFeed />

        <SiteFooter className="mt-12" />
      </div>
    </main>
  )
}
