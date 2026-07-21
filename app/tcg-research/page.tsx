import { TcgResearchClient } from "@/components/tcg-research-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "TCG Research",
  description:
    "Search Pokémon, Lorcana, and MTG cards with local market prices, grade spreads, price history charts, and Scrydex Vision scanning.",
  path: "/tcg-research",
})

export default function TcgResearchPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <TcgResearchClient />
      </div>
    </main>
  )
}
