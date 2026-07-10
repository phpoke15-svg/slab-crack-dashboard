"use client"

import { Suspense, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteFooter } from "@/components/legal/site-footer"
import { SignInForm } from "@/components/trade-binder/auth/sign-in-form"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"

function SignInPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading } = useAuth()
  const next = searchParams.get("next") ?? "/"

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(next)
    }
  }, [isLoading, user, next, router])

  if (!isLoading && user) {
    return null
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <CollecToolsBrand href="/" size="sm" subtitle="Collector account" />
        <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Back
        </Link>
      </header>

      <SignInForm onSuccess={() => router.replace(next)} />

      <p className="mt-6 text-center text-xs text-muted-foreground text-pretty">
        Your account works across PokeMatch and SlabCrack.
      </p>

      <SiteFooter className="mt-8" />
    </div>
  )
}

export function SignInPageClient() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SignInPageContent />
    </Suspense>
  )
}
