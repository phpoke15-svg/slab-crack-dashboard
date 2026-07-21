import { LabsTabClient } from "@/components/tab-views/labs-tab-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Labs",
  description: "SlabLabs graded slab toolkit and Grade Check submission prep in one dashboard.",
  path: "/labs",
})

export default function LabsPage() {
  return (
    <main className="min-h-dvh bg-background">
      <LabsTabClient />
    </main>
  )
}
