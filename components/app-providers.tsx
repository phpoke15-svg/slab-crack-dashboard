"use client"

import { EntitlementsProvider } from "@/components/billing/entitlements-provider"
import { ProPushAlertsPrompt } from "@/components/pro-push-alerts-prompt"
import { AuthProvider } from "@/components/trade-binder/auth/auth-provider"
import { SignInModal } from "@/components/trade-binder/auth/sign-in-modal"
import { SocialProvider } from "@/components/trade-binder/social/social-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <EntitlementsProvider>
        <SocialProvider>
          {children}
          <SignInModal />
          <ProPushAlertsPrompt />
        </SocialProvider>
      </EntitlementsProvider>
    </AuthProvider>
  )
}
