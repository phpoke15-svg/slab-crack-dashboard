import { SlabcrackScanClient } from "@/components/slabcrack-scan-client"
import { pageMetadata } from "@/lib/seo"
import { SLABIT_HREF } from "@/lib/slabs-labs-routes"

export const metadata = pageMetadata({
  title: "SlabIt Scan",
  description:
    "Point your camera at a Pokémon card, identify it with Gemini, and open PSA 10 spread, multiplier, and grading ROI.",
  path: `${SLABIT_HREF}/scan`,
  noIndex: true,
})

export default function SlabItScanPage() {
  return (
    <main className="min-h-dvh bg-black">
      <SlabcrackScanClient tool="slabit" />
    </main>
  )
}
