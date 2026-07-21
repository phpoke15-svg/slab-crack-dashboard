"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { activeAppNavTab, APP_NAV_TABS } from "@/lib/app-nav"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname() ?? "/"
  const activeTab = activeAppNavTab(pathname)

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/75 backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-lg items-stretch justify-around px-2 pt-2 pb-safe">
        {APP_NAV_TABS.map((tab) => {
          const Icon = tab.icon
          const active = tab.id === activeTab

          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors sm:text-[11px]",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl transition-all",
                  active
                    ? "bg-primary/15 text-primary shadow-[0_0_18px_oklch(0.78_0.17_155/0.35)]"
                    : "bg-transparent",
                )}
              >
                <Icon className="size-[1.125rem]" strokeWidth={active ? 2.25 : 2} />
              </span>
              <span className="truncate">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
