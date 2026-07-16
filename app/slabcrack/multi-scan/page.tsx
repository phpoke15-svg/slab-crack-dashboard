import { MultiCardScanClient } from "@/components/multi-card-scan-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "SlabCrack Multi-Scan",
  description:
    "Scan 1–9 Pokémon cards at once — stability-gated capture, box detect, and phash-first identification with SlabCrack + SlabLab pricing.",
  path: "/slabcrack/multi-scan",
  noIndex: true,
})

export default function SlabcrackMultiScanPage() {
  return (
    <main className="min-h-dvh bg-black">
      <MultiCardScanClient tool="slabcrack" />
    </main>
  )
}
