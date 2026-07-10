import { RestocksClient } from "@/components/restocks-client"

export const metadata = {
  title: "Restocks — CollecTools",
  description:
    "Auto-discovered Walmart Pokémon TCG sealed stock. Pokémon Center queue alerts live in Queue Watch.",
}

export default function RestocksPage() {
  return (
    <div className="min-h-dvh bg-background">
      <RestocksClient />
    </div>
  )
}
