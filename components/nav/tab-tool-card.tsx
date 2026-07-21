import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function TabToolCard({
  href,
  name,
  blurb,
  icon: Icon,
  supremeOnly,
  featured,
  onClick,
}: {
  href: string
  name: string
  blurb: string
  icon: LucideIcon
  supremeOnly?: boolean
  featured?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border p-4 transition-colors",
        featured
          ? "border-primary/35 bg-primary/[0.07] hover:border-primary/50 hover:bg-primary/[0.11]"
          : "border-border bg-card/50 hover:border-primary/35 hover:bg-card",
        supremeOnly && !featured && "border-primary/20 bg-primary/[0.03]",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl border text-primary",
          featured ? "border-primary/35 bg-primary/15" : "border-primary/30 bg-primary/10",
        )}
      >
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-base font-bold text-foreground">{name}</span>
          {supremeOnly ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
              Supreme
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{blurb}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  )
}
