import { SlabcrackScanClient } from "@/components/slabcrack-scan-client"
import { pageMetadata } from "@/lib/seo"
import { SLABCRACK_HREF } from "@/lib/slabs-labs-routes"

export const metadata = pageMetadata({
  title: "SlabCrack Scan",
  description:
    "Point your camera at a Pokémon card, identify it with Gemini, and open SlabCrack arbitrage pricing.",
  path: `${SLABCRACK_HREF}/scan`,
  noIndex: true,
})

export default function SlabCrackScanPage() {
  return (
    <main className="min-h-dvh bg-black">
      <SlabcrackScanClient tool="slabcrack" />
    </main>
  )
}
