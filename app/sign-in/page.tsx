import { SignInPageClient } from "@/components/sign-in-page-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to CollecTools to sync binders, trades, and subscription access.",
  path: "/sign-in",
  noIndex: true,
})

export default function SignInPage() {
  return (
    <main className="min-h-dvh bg-background">
      <SignInPageClient />
    </main>
  )
}
