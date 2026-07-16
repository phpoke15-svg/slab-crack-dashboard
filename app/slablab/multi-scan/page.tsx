import { MultiCardScanClient } from "@/components/multi-card-scan-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "SlabLab Multi-Scan",
  description:
    "Scan 1–9 Pokémon cards at once for PSA 10 ROI and SlabCrack arbitrage data per card.",
  path: "/slablab/multi-scan",
  noIndex: true,
})

export default function SlablabMultiScanPage() {
  return (
    <main className="min-h-dvh bg-black">
      <MultiCardScanClient tool="slablab" />
    </main>
  )
}
