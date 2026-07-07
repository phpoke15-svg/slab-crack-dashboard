"use client"

import { MyBinder } from "@/components/trade-binder/binder/my-binder"
import { AuthProvider } from "@/components/trade-binder/auth/auth-provider"
import { SocialProvider } from "@/components/trade-binder/social/social-provider"

export function TradeBinderClient() {
  return (
    <AuthProvider>
      <SocialProvider>
        <MyBinder />
      </SocialProvider>
    </AuthProvider>
  )
}
