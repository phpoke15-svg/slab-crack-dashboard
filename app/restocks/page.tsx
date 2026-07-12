import { redirect } from "next/navigation"
import { RestocksClient } from "@/components/restocks-client"
import { RESTOCKS_ENABLED } from "@/lib/collectools-tools"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { pageMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"

export const metadata = pageMetadata({
  title: "Restocks",
  description:
    "Track Walmart sealed Pokémon TCG restocks and stock status across curated SKUs.",
  path: "/restocks",
  noIndex: !RESTOCKS_ENABLED,
})

export default async function RestocksPage() {
  if (!RESTOCKS_ENABLED) {
    const auth = await requireUser()
    if (!auth.ok) redirect(`/sign-in?next=${encodeURIComponent("/restocks")}`)
    const entitlements = await getEntitlementsForUser(auth.user.id)
    if (!entitlements.supreme) redirect("/")
  }

  return (
    <main className="min-h-dvh bg-background">
      <RestocksClient />
    </main>
  )
}
