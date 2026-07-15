import { redirect } from "next/navigation"
import { SlabcrackScanClient } from "@/components/slabcrack-scan-client"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { pageMetadata } from "@/lib/seo"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const metadata = pageMetadata({
  title: "SlabCrack Scan",
  description:
    "Point your camera at a Pokémon card, identify it with Gemini, and open live SlabCrack raw vs PSA prices.",
  path: "/slabcrack/scan",
  noIndex: true,
})

export default async function SlabcrackScanPage() {
  const auth = await requireUser()
  if (!auth.ok) {
    redirect(`/sign-in?next=${encodeURIComponent("/slabcrack/scan")}`)
  }
  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.cardScanner) {
    redirect("/pricing?feature=scan")
  }

  return (
    <main className="min-h-dvh bg-black">
      <SlabcrackScanClient tool="slabcrack" />
    </main>
  )
}
