"use client"

import { MyBinder } from "@/components/trade-binder/binder/my-binder"
import { AuthProvider } from "@/components/trade-binder/auth/auth-provider"
import { SocialProvider } from "@/components/trade-binder/social/social-provider"
import { CollecToolsBrand } from "@/components/collectools-brand"

export function TradeBinderClient() {
  return (
    <AuthProvider>
      <SocialProvider>
        <div className="mx-auto w-full max-w-md">
          <div className="border-b border-border px-4 py-3">
            <CollecToolsBrand href="/" subtitle="Trade Binder" size="sm" />
          </div>
          <MyBinder />
        </div>
      </SocialProvider>
    </AuthProvider>
  )
}
