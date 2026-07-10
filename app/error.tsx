"use client"

import { useEffect } from "react"
import Link from "next/link"
import { CollecToolsBrand } from "@/components/collectools-brand"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[CollecTools]", error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <CollecToolsBrand href="/" size="lg" subtitle="Something went wrong" />
      <p className="mt-6 text-sm text-muted-foreground">
        An unexpected error occurred. Try again, or return to the hub.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
        >
          Home
        </Link>
      </div>
    </div>
  )
}
