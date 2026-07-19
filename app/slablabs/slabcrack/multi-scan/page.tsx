import { MultiCardScanClient } from "@/components/multi-card-scan-client"
import { pageMetadata } from "@/lib/seo"
import { SLABCRACK_HREF } from "@/lib/slabs-labs-routes"

export const metadata = pageMetadata({
  title: "SlabCrack Multi-Scan",
  description:
    "Scan 1–9 Pokémon cards at once — stability-gated capture, box detect, and phash-first identification with SlabCrack + SlabIt pricing.",
  path: `${SLABCRACK_HREF}/multi-scan`,
  noIndex: true,
})

export default function SlabCrackMultiScanPage() {
  return (
    <main className="min-h-dvh bg-black">
      <MultiCardScanClient tool="slabcrack" />
    </main>
  )
}
