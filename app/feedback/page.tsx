import type { Metadata } from "next"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { FeedbackClient } from "@/components/feedback-client"
import { pageMetadata } from "@/lib/seo"

const description =
  "Send product feedback to CollecTools and vote on potential tools so we know what collectors want next."

export const metadata: Metadata = pageMetadata({
  title: "Feedback",
  description,
  path: "/feedback",
})

export default function FeedbackPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_155_/_0.12),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CollecToolsBrand href="/" size="lg" subtitle="Feedback · ideas & votes" />
            <h1 className="mt-5 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Feedback
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Tell us what to improve, then upvote the potential tools you want most.
            </p>
          </div>
          <SiteAuthButton className="shrink-0" />
        </header>

        <FeedbackClient />

        <SiteFooter className="mt-12" />
      </div>
    </main>
  )
}
