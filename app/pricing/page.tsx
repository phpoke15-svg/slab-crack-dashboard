import type { Metadata } from "next"
import { Suspense } from "react"
import { PricingClient } from "@/components/pricing-client"

export const metadata: Metadata = {
  title: "Pricing — CollecTools",
  description:
    "Free tools with ads. Premium removes ads from $1.99/mo. Pro adds Pokemon Center Queue Watch from $9.99/mo.",
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
