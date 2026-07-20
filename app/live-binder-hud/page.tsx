import { redirect } from "next/navigation"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { pageMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"

export const metadata = pageMetadata({
  title: "Live Binder HUD",
  description:
    "Supreme preview: Gemini box_2d multi-card detect on one frame, dynamic HUD overlays, PriceCharting comps.",
  path: "/live-binder-hud",
  noIndex: true,
})

/** Live Binder HUD is Supreme-only while in development. */
export default async function LiveBinderHudPage() {
  const auth = await requireUser()
  if (!auth.ok) redirect(`/sign-in?next=${encodeURIComponent("/live-binder-hud")}`)
  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) redirect("/")

  return (
    <main className="fixed inset-0 bg-black">
      <iframe
        title="Live Binder HUD"
        src="/live-binder-hud/app.html?v=20260715e"
        className="h-full w-full border-0"
        allow="camera; microphone=(); fullscreen"
      />
    </main>
  )
}
