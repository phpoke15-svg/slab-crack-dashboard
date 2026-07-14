import { SlabcrackScanClient } from "@/components/slabcrack-scan-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "SlabLab Scan",
  description:
    "Point your camera at a Pokémon card, identify it with Gemini, and open PSA 10 spread, multiplier, and grading ROI.",
  path: "/slablab/scan",
  noIndex: true,
})

export default function SlabLabScanPage() {
  return (
    <main className="min-h-dvh bg-black">
      <SlabcrackScanClient tool="slablab" />
    </main>
  )
}
