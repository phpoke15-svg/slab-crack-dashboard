import { redirect } from "next/navigation"
import { RestocksClient } from "@/components/restocks-client"
import { RESTOCKS_ENABLED } from "@/lib/collectools-tools"

export const metadata = {
  title: "Restocks — CollecTools",
  description: "Walmart sealed Pokémon TCG stock tracker.",
}

export default function RestocksPage() {
  if (!RESTOCKS_ENABLED) {
    redirect("/")
  }

  return (
    <main className="min-h-dvh bg-background">
      <RestocksClient />
    </main>
  )
}
