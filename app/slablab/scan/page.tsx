import { redirect } from "next/navigation"
import { CARD_SCANNER_ENABLED } from "@/lib/feature-flags"
import { SlabcrackScanClient } from "@/components/slabcrack-scan-client"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { pageMetadata } from "@/lib/seo"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const metadata = pageMetadata({
  title: "SlabLab Scan",
  description:
    "Point your camera at a Pokémon card, identify it with Gemini, and open PSA 10 spread, multiplier, and grading ROI.",
  path: "/slablab/scan",
  noIndex: true,
})

export default async function SlabLabScanPage() {
  if (!CARD_SCANNER_ENABLED) redirect("/slablab")

  const auth = await requireUser()
  if (!auth.ok) {
    redirect(`/sign-in?next=${encodeURIComponent("/slablab/scan")}`)
  }
  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.cardScanner) {
    redirect("/pricing?feature=scan")
  }

  return (
    <main className="min-h-dvh bg-black">
      <SlabcrackScanClient tool="slablab" />
    </main>
  )
}
