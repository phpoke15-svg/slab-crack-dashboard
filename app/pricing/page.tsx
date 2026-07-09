import { Suspense } from "react"
import { PricingClient } from "@/components/pricing-client"

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
