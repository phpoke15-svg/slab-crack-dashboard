"use client"

import dynamic from "next/dynamic"

export const GradeCheckClient = dynamic(
  () => import("@/components/grade-check/grade-check-wizard").then((mod) => mod.GradeCheckWizard),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading Grade Check…</p>
      </div>
    ),
  },
)
