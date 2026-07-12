import { redirect } from "next/navigation"
import { GradeCheckClient } from "@/components/grade-check-client"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"
import { getEntitlementsForUser } from "@/lib/billing/stripe"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Grade Check",
  description: "Condition helper for PSA submissions (Supreme preview).",
  robots: { index: false, follow: false },
}

/** Grade Check is Supreme-only while unfinished. */
export default async function GradeCheckPage() {
  const auth = await requireUser()
  if (!auth.ok) redirect(`/sign-in?next=${encodeURIComponent("/grade-check")}`)
  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) redirect("/")

  return (
    <main className="min-h-dvh bg-background">
      <GradeCheckClient />
    </main>
  )
}
