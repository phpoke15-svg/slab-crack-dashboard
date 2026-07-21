"use client"

import { TabShellHeader } from "@/components/nav/tab-shell-header"
import { TabToolCard } from "@/components/nav/tab-tool-card"
import { hubToolsForUser } from "@/lib/collectools-tools"

export function CommunityTabClient() {
  const tools = hubToolsForUser({ supreme: false })
  const pokeMatch = tools.find((tool) => tool.id === "binder")
  const cardLounge = tools.find((tool) => tool.id === "card-lounge")

  return (
    <div className="app-tab-shell mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pt-5 pb-8 sm:px-5">
      <TabShellHeader title="Community" subtitle="PokeMatch · CardLounge" />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trade & binders</h2>
        {pokeMatch ? (
          <TabToolCard
            href={pokeMatch.href}
            name={pokeMatch.name}
            blurb={pokeMatch.blurb}
            icon={pokeMatch.icon}
            featured
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social feed</h2>
        {cardLounge ? (
          <TabToolCard
            href={cardLounge.href}
            name={cardLounge.name}
            blurb={cardLounge.blurb}
            icon={cardLounge.icon}
          />
        ) : null}
      </section>
    </div>
  )
}
