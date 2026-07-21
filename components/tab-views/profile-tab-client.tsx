"use client"

import Link from "next/link"
import { Crown, Gift } from "lucide-react"
import { TabShellHeader } from "@/components/nav/tab-shell-header"
import { TabToolCard } from "@/components/nav/tab-tool-card"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { hubToolsForUser } from "@/lib/collectools-tools"
import { cn } from "@/lib/utils"

export function ProfileTabClient() {
  const entitlements = useOptionalEntitlements()
  const supreme = Boolean(entitlements?.supreme)
  const plan = entitlements?.plan ?? "free"
  const tools = hubToolsForUser({ supreme })
  const giveaway = tools.find((tool) => tool.id === "giveaway")
  const feedback = tools.find((tool) => tool.id === "feedback")
  const siteInsights = tools.find((tool) => tool.id === "supreme")

  const planLabel =
    plan === "pro" ? "Pro" : plan === "premium" ? "Premium" : supreme ? "Supreme" : "Free"

  return (
    <div className="app-tab-shell mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pt-5 pb-8 sm:px-5">
      <TabShellHeader title="Profile" subtitle="Giveaway · feedback · tiers" />

      <div className="rounded-2xl border border-border bg-card/50 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Crown className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {entitlements?.signedIn ? "Your membership" : "Sign in for entries & sync"}
            </p>
            <p className="text-xs text-muted-foreground">
              Current plan: <span className="font-medium text-foreground">{planLabel}</span>
            </p>
          </div>
          <Link
            href="/pricing"
            className="shrink-0 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            Tier info
          </Link>
        </div>
      </div>

      {giveaway ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rewards</h2>
          <Link
            href={giveaway.href}
            className="group flex items-center gap-3 rounded-2xl border border-primary/35 bg-primary/[0.07] p-4 transition-colors hover:border-primary/50 hover:bg-primary/[0.11]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/15 text-primary">
              <Gift className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-foreground">{giveaway.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{giveaway.blurb}</span>
            </span>
          </Link>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">More</h2>
        <div className="grid gap-2">
          {feedback ? (
            <TabToolCard
              href={feedback.href}
              name={feedback.name}
              blurb={feedback.blurb}
              icon={feedback.icon}
            />
          ) : null}
          {siteInsights ? (
            <TabToolCard
              href={siteInsights.href}
              name={siteInsights.name}
              blurb={siteInsights.blurb}
              icon={siteInsights.icon}
              supremeOnly
            />
          ) : null}
        </div>
      </section>

      {!entitlements?.isLoading && entitlements?.signedIn && plan === "free" ? (
        <p
          className={cn(
            "rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground",
          )}
        >
          Go Premium from $4.99/mo for full SlabCrack and ad-free browsing.{" "}
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            View plans
          </Link>
        </p>
      ) : null}
    </div>
  )
}
