import { RestocksClient } from "@/components/restocks-client"

export const metadata = {
  title: "Restocks — CollecTools",
  description:
    "Live Walmart and Pokémon Center availability for curated Pokémon TCG sealed products.",
}

export default function RestocksPage() {
  return (
    <div className="min-h-dvh bg-background">
      <RestocksClient />
    </div>
  )
}
