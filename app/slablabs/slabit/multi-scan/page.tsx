import { MultiCardScanClient } from "@/components/multi-card-scan-client"
import { pageMetadata } from "@/lib/seo"
import { SLABIT_HREF } from "@/lib/slabs-labs-routes"

export const metadata = pageMetadata({
  title: "SlabIt Multi-Scan",
  description:
    "Scan 1–9 Pokémon cards at once for PSA 10 ROI and SlabCrack arbitrage data per card.",
  path: `${SLABIT_HREF}/multi-scan`,
  noIndex: true,
})

export default function SlabItMultiScanPage() {
  return (
    <main className="min-h-dvh bg-black">
      <MultiCardScanClient tool="slabit" />
    </main>
  )
}
