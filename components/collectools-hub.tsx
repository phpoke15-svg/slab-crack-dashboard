"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteFooter } from "@/components/legal/site-footer"
import { FooterAd } from "@/components/footer-ad"
import { SiteAuthButton } from "@/components/site-auth-button"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { COLLECTOOLS } from "@/lib/collectools-tools"
import { cn } from "@/lib/utils"

export function CollecToolsHub() {
  const entitlements = useOptionalEntitlements()
  const showUpgrade =
    !entitlements?.isLoading && entitlements?.signedIn && entitlements.plan === "free"
  const showProNudge =
    !entitlements?.isLoading && entitlements?.signedIn && entitlements.plan === "premium"

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CollecToolsBrand href={undefined} size="lg" subtitle="Tools for TCG collectors" />
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Pick a tool to get started. SlabCrack finds arbitrage, PokeMatch keeps your collection
            organized for swaps, and Queue Watch alerts you when Pokemon Center&apos;s queue goes live.
          </p>
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      {showUpgrade ? (
        <p className="mb-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          Go ad-free from $1.99/mo.{" "}
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            View Premium & Pro
          </Link>
        </p>
      ) : null}
      {showProNudge ? (
        <p className="mb-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          You&apos;re on Premium. Unlock Pokemon Center Queue Watch with Pro.{" "}
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            Upgrade
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-1">
        {COLLECTOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.id}
              href={tool.href}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-5 transition-all",
                "hover:border-primary/40 hover:bg-card hover:shadow-[0_0_40px_-12px] hover:shadow-primary/25",
              )}
            >
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="size-6" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{tool.name}</h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {tool.tagline}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                  {tool.highlights && tool.highlights.length > 0 && (
                    <ul className="mt-2.5 space-y-1 text-xs leading-relaxed text-muted-foreground">
                      {tool.highlights.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-primary" aria-hidden>
                            ·
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          )
        })}
      </div>

      <FooterAd className="mt-10" />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/pricing" className="font-medium text-primary hover:underline">
          Premium & Pro plans
        </Link>
        {" · "}
        ad-free from $1.99/mo · Queue Watch with Pro
      </p>
      <SiteFooter className="mt-auto pt-10" />
    </div>
  )
}
