import type { Metadata } from "next"
import { GradeCheckClient } from "@/components/grade-check-client"

export const metadata: Metadata = {
  title: "Grade Check — CollecTools",
  description:
    "Estimate PSA grade before you submit. Photo centering guide, condition checklist, and live slab comp ROI.",
}

export default function GradeCheckPage() {
  return (
    <div className="min-h-dvh bg-background">
      <GradeCheckClient />
    </div>
  )
}
