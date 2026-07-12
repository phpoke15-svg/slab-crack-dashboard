import type { Metadata } from "next"
import { SupremeConsoleClient } from "@/components/supreme-console-client"

export const metadata: Metadata = {
  title: "Supreme Console — CollecTools",
  description: "Owner metrics and in-development tools.",
  robots: { index: false, follow: false },
}

export default function SupremePage() {
  return <SupremeConsoleClient />
}
