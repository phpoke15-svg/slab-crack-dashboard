"use client"

import dynamic from "next/dynamic"

export const SlabDashboardClient = dynamic(
  () => import("@/components/slab-dashboard").then((mod) => mod.SlabDashboard),
  {
    loading: () => (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading SlabCrack…</p>
      </div>
    ),
  },
)
