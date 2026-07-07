import type { LucideIcon } from "lucide-react"
import { BookOpen, Layers, ShieldCheck } from "lucide-react"

export type CollecTool = {
  id: string
  href: string
  name: string
  tagline: string
  description: string
  icon: LucideIcon
}

export const COLLECTOOLS: CollecTool[] = [
  {
    id: "slabcrack",
    href: "/slabcrack",
    name: "SlabCrack",
    tagline: "Graded slab arbitrage",
    description:
      "Find PSA slabs selling for less than a raw Near-Mint copy. Live deficit feed and card lookup.",
    icon: Layers,
  },
  {
    id: "grade-check",
    href: "/grade-check",
    name: "Grade Check",
    tagline: "Pre-submission estimator",
    description:
      "Upload photos, check centering, score condition, and estimate PSA ROI before you submit.",
    icon: ShieldCheck,
  },
  {
    id: "binder",
    href: "/binder",
    name: "Perfect Match",
    tagline: "Collect & trade",
    description:
      "Build your binder, mark cards for trade or wishlist, and connect with other collectors.",
    icon: BookOpen,
  },
]
