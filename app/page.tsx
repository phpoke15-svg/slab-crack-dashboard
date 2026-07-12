import { CollecToolsHub } from "@/components/collectools-hub"
import { pageMetadata, SEO_DEFAULT_DESCRIPTION, SEO_DEFAULT_TITLE } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Home",
  absoluteTitle: SEO_DEFAULT_TITLE,
  description: SEO_DEFAULT_DESCRIPTION,
  path: "/",
})

export default function Page() {
  return (
    <main className="min-h-dvh bg-background">
      <CollecToolsHub />
    </main>
  )
}
