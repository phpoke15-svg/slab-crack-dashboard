"use client"

import Link from "next/link"
import { TabShellHeader } from "@/components/nav/tab-shell-header"
import { TabToolCard } from "@/components/nav/tab-tool-card"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import { hubToolsForUser } from "@/lib/collectools-tools"
import { SLABLABS_HREF } from "@/lib/slabs-labs-routes"
import { SLABLABS_SUBTOOLS } from "@/lib/slabs-labs-tools"

export function LabsTabClient() {
  const entitlements = useOptionalEntitlements()
  const supreme = Boolean(entitlements?.supreme)
  const tools = hubToolsForUser({ supreme })
  const slabLabs = tools.find((tool) => tool.id === "slablabs")
  const gradeCheck = tools.find((tool) => tool.id === "grade-check")

  return (
    <div className="app-tab-shell mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pt-5 pb-8 sm:px-5">
      <TabShellHeader title="Labs" subtitle="SlabLabs · Grade Check" />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SlabLabs toolkit</h2>
          {slabLabs ? (
            <Link href={SLABLABS_HREF} className="text-xs font-semibold text-primary hover:underline">
              Open hub
            </Link>
          ) : null}
        </div>

        <div className="grid gap-2">
          {SLABLABS_SUBTOOLS.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-3.5 transition-colors hover:border-primary/35 hover:bg-card"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="size-4" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-foreground">{tool.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{tool.blurb}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {gradeCheck ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submission prep</h2>
          <TabToolCard
            href={gradeCheck.href}
            name={gradeCheck.name}
            blurb={gradeCheck.blurb}
            icon={gradeCheck.icon}
            supremeOnly={gradeCheck.supremeOnly}
          />
        </section>
      ) : null}
    </div>
  )
}
