import { ResetPasswordPageClient } from "@/components/reset-password-page-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Reset password",
  description: "Choose a new CollecTools password.",
  path: "/reset-password",
  noIndex: true,
})

export default function ResetPasswordPage() {
  return (
    <main className="min-h-dvh bg-background">
      <ResetPasswordPageClient />
    </main>
  )
}
