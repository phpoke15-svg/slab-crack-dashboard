import type { Metadata } from "next"
import Link from "next/link"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Page not found",
  description: "This CollecTools page does not exist.",
  path: "/404",
  noIndex: true,
})

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <CollecToolsBrand href="/" size="lg" subtitle="Page not found" />
      <p className="mt-6 text-sm text-muted-foreground">
        That page doesn&apos;t exist or moved. Head back to the tools hub.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Back to CollecTools
      </Link>
    </div>
  )
}
