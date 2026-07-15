"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, X } from "lucide-react"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteFooter } from "@/components/legal/site-footer"
import { FooterAd } from "@/components/footer-ad"
import { SiteAuthButton } from "@/components/site-auth-button"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { hubToolsForUser, type CollecTool } from "@/lib/collectools-tools"
import { cn } from "@/lib/utils"

export function CollecToolsHub() {
  const entitlements = useOptionalEntitlements()
  const showUpgrade =
    !entitlements?.isLoading && entitlements?.signedIn && entitlements.plan === "free"
  const showProNudge =
    !entitlements?.isLoading && entitlements?.signedIn && entitlements.plan === "premium"
  const tools = hubToolsForUser({ supreme: Boolean(entitlements?.supreme) })
  const [selected, setSelected] = useState<CollecTool | null>(null)

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null)
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [selected])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <CollecToolsBrand
            href={undefined}
            size="lg"
            asHeading
            subtitle="Pokémon TCG collector toolkit"
          />
          <SiteAuthButton className="shrink-0" />
        </div>

        <div className="mt-5 w-full space-y-3">
          <p className="w-full text-base font-medium leading-snug text-foreground sm:text-lg">
            The Ultimate Tool Kit for Pokemon Card Collectors!
          </p>
          <Link
            href="/pricing"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/15 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
          >
            View membership tiers
            <span className="ml-1.5 font-medium text-muted-foreground">Free · Premium · Pro</span>
          </Link>
        </div>
      </header>

      {showUpgrade ? (
        <p className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          Go Premium from $4.99/mo for top 100 SlabCrack + SlabLab boards, ad-free.{" "}
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            View plans
          </Link>
        </p>
      ) : null}
      {showProNudge ? (
        <p className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          You&apos;re on Premium. Go Pro for the full feeds, camera scanner, search, and PokeWatch.{" "}
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            Upgrade
          </Link>
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setSelected(tool)}
              className={cn(
                "group flex w-full flex-col items-start gap-2 rounded-xl border border-border bg-card/60 p-3 text-left transition-colors",
                "hover:border-primary/40 hover:bg-card",
                tool.supremeOnly && "border-primary/25 bg-primary/[0.03]",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="size-4" strokeWidth={2} />
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </span>
              <span className="min-w-0 w-full">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-base font-bold leading-tight text-foreground sm:text-lg">
                    {tool.name}
                  </span>
                  {tool.supremeOnly ? (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                      Supreme
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground line-clamp-2">
                  {tool.blurb}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <FooterAd className="mt-10" />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/pricing" className="font-medium text-primary hover:underline">
          Premium & Pro plans
        </Link>
        {" · "}
        ad-free top 100 boards from $4.99/mo · full access + PokeWatch with Pro
      </p>
      <SiteFooter className="mt-auto pt-10" />

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close tool details"
            onClick={() => setSelected(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} details`}
            className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-popover sm:rounded-3xl"
          >
            <div className="relative flex items-center justify-center pt-3">
              <span className="h-1.5 w-10 rounded-full bg-border sm:hidden" />
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-5 pt-2">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <selected.icon className="size-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">{selected.name}</h2>
                    {selected.supremeOnly ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Supreme
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{selected.tagline}</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {selected.description}
              </p>

              {selected.highlights && selected.highlights.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {selected.highlights.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-primary" aria-hidden>
                        ·
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <Link
                href={selected.href}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open {selected.name}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
