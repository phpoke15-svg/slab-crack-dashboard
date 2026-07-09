import type { LucideIcon } from "lucide-react"
import { Bell, BookOpen, Layers, ShieldCheck } from "lucide-react"

export type CollecTool = {
  id: string
  href: string
  name: string
  tagline: string
  description: string
  highlights?: string[]
  icon: LucideIcon
}

export const COLLECTOOLS: CollecTool[] = [
  {
    id: "slabcrack",
    href: "/slabcrack",
    name: "SlabCrack",
    tagline: "Graded slab arbitrage",
    description:
      "Find PSA slabs selling for less than a raw Near-Mint copy. Live deficit feed, card lookup, and watchlists.",
    highlights: [
      "Buy, crack, and sell — spot slabs where cracking and selling raw beats the market price",
      "Buy high-end cards under market for your personal collection",
      "Market awareness — track graded vs raw pricing gaps and stay ahead of the market",
    ],
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
    name: "PokeMatch",
    tagline: "Collect & trade",
    description:
      "Build your binder, mark cards for trade or wishlist, and connect with other collectors.",
    icon: BookOpen,
  },
  {
    id: "queue-watch",
    href: "/queue-watch",
    name: "Queue Watch",
    tagline: "Pokemon Center alerts",
    description:
      "Instant browser and Discord alerts when the Pokemon Center virtual queue goes live.",
    icon: Bell,
  },
]
