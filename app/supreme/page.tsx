import type { Metadata } from "next"
import { SupremeConsoleClient } from "@/components/supreme-console-client"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Site Insights",
  description: "Owner site insights, product metrics, and in-development tools.",
  path: "/supreme",
  noIndex: true,
})

export default function SupremePage() {
  return <SupremeConsoleClient />
}
