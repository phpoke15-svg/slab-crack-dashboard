"use client"

import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/nav/bottom-nav"
import { shouldShowBottomNav } from "@/lib/app-nav"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/"
  const showBottomNav = shouldShowBottomNav(pathname)

  return (
    <>
      <div className={cn(showBottomNav && "pb-bottom-nav")}>{children}</div>
      {showBottomNav ? <BottomNav /> : null}
    </>
  )
}
