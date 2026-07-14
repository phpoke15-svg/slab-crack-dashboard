import { SlabcrackScanClient } from "@/components/slabcrack-scan-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "SlabCrack Scan",
  description:
    "Point your camera at a Pokémon card, identify it with Gemini, and open live SlabCrack raw vs PSA prices.",
  path: "/slabcrack/scan",
  noIndex: true,
})

export default function SlabcrackScanPage() {
  return (
    <main className="min-h-dvh bg-black">
      <SlabcrackScanClient tool="slabcrack" />
    </main>
  )
}
