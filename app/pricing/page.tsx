import type { Metadata } from "next"
import { Suspense } from "react"
import { PricingClient } from "@/components/pricing-client"

export const metadata: Metadata = {
  title: "Pricing — CollecTools",
  description:
    "Never miss a Pokémon Center queue again. Premium $4.99/mo and Pro $9.99/mo — both with a 7-day free trial.",
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Loading plans…</p>
        </div>
      }
    >
      <PricingClient />
    </Suspense>
  )
}
