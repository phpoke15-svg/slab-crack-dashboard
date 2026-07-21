"use client"

import { EntitlementsProvider } from "@/components/billing/entitlements-provider"
import { GiveawayTracker } from "@/components/giveaway-tracker"
import { AppShell } from "@/components/nav/app-shell"
import { ProPushAlertsPrompt } from "@/components/pro-push-alerts-prompt"
import { AuthProvider } from "@/components/trade-binder/auth/auth-provider"
import { SignInModal } from "@/components/trade-binder/auth/sign-in-modal"
import { SocialProvider } from "@/components/trade-binder/social/social-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <EntitlementsProvider>
        <SocialProvider>
          <AppShell>{children}</AppShell>
          <SignInModal />
          <GiveawayTracker />
          <ProPushAlertsPrompt />
        </SocialProvider>
      </EntitlementsProvider>
    </AuthProvider>
  )
}
