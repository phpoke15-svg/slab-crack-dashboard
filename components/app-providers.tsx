"use client"

import { AuthProvider } from "@/components/trade-binder/auth/auth-provider"
import { SignInModal } from "@/components/trade-binder/auth/sign-in-modal"
import { SocialProvider } from "@/components/trade-binder/social/social-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SocialProvider>
        {children}
        <SignInModal />
      </SocialProvider>
    </AuthProvider>
  )
}
