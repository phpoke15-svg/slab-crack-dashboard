"use client"

import { useState } from "react"
import Link from "next/link"
import { TabShellHeader } from "@/components/nav/tab-shell-header"
import { TabToolCard } from "@/components/nav/tab-tool-card"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { hubToolsForUser } from "@/lib/collectools-tools"
import { cn } from "@/lib/utils"

type AlertsFeed = "pokewatch" | "restocks"

export function AlertsTabClient() {
  const entitlements = useOptionalEntitlements()
  const supreme = Boolean(entitlements?.supreme)
  const tools = hubToolsForUser({ supreme })
  const pokeWatch = tools.find((tool) => tool.id === "pokewatch")
  const restocks = tools.find((tool) => tool.id === "restocks")
  const [feed, setFeed] = useState<AlertsFeed>("pokewatch")

  const activeTool = feed === "pokewatch" ? pokeWatch : restocks

  return (
    <div className="app-tab-shell mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pt-5 pb-8 sm:px-5">
      <TabShellHeader title="Alerts" subtitle="PokeWatch · Restocks" />

      <div className="flex rounded-2xl border border-border bg-secondary/30 p-1" role="tablist">
        {(
          [
            { id: "pokewatch" as const, label: "PokeWatch" },
            { id: "restocks" as const, label: "Restocks" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={feed === tab.id}
            onClick={() => setFeed(tab.id)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              feed === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTool ? (
        <div className="space-y-4">
          <TabToolCard
            href={activeTool.href}
            name={activeTool.name}
            blurb={activeTool.blurb}
            icon={activeTool.icon}
            supremeOnly={activeTool.supremeOnly}
            featured
          />
          <p className="rounded-2xl border border-border bg-card/40 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
            {activeTool.description}
          </p>
          <Link
            href={activeTool.href}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open {activeTool.name}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
