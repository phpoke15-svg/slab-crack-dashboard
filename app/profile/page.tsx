import { ProfileTabClient } from "@/components/tab-views/profile-tab-client"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Profile",
  description: "Monthly giveaway entries, feedback, membership tiers, and account tools.",
  path: "/profile",
})

export default function ProfilePage() {
  return (
    <main className="min-h-dvh bg-background">
      <ProfileTabClient />
    </main>
  )
}
