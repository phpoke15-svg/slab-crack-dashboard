import type { LucideIcon } from "lucide-react"
import { Bell, BookOpen, Layers, Package, Ratio } from "lucide-react"

/** Flip to true when Walmart Affiliate Restocks ships again. */
export const RESTOCKS_ENABLED = false

export type CollecTool = {
  id: string
  href: string
  name: string
  tagline: string
  description: string
  highlights?: string[]
  icon: LucideIcon
}

const ALL_COLLECTOOLS: CollecTool[] = [
  {
    id: "slabcrack",
    href: "/slabcrack",
    name: "SlabCrack",
    tagline: "Graded slab arbitrage",
    description:
      "Find undervalued cards. Premium unlocks the full feed of deficits.",
    highlights: [
      "Buy, crack, and sell — spot slabs where cracking and selling raw beats the market price",
      "Buy high-end cards under market for your personal collection",
      "Market awareness — track graded vs raw pricing gaps and stay ahead of the market",
    ],
    icon: Layers,
  },
  {
    id: "slablab",
    href: "/slablab",
    name: "SlabLab",
    tagline: "Spread · multiplier · ROI",
    description:
      "Rank modern cards by PSA 10 gross spread, graded multiplier, and gem-rate-weighted submission yield.",
    highlights: [
      "Toggle past 3 vs 5 years of releases",
      "Filter by minimum PSA 10 gem rate from pop reports",
      "Flag Prime Submission Slots and 10-or-Bust danger zones",
    ],
    icon: Ratio,
  },
  {
    id: "restocks",
    href: "/restocks",
    name: "Restocks",
    tagline: "Walmart sealed stock",
    description:
      "Auto-discovers Pokémon TCG sealed products at Walmart and tracks in-stock vs OOS. Pokémon Center drops use Queue Watch.",
    icon: Package,
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
    tagline: "Pro · Pokemon Center alerts",
    description:
      "Instant browser and phone alerts when the Pokemon Center virtual queue goes live. Included with CollecTools Pro.",
    icon: Bell,
  },
]

/** Tools shown on the hub / nav. Restocks stays in code but hidden while Affiliate is off. */
export const COLLECTOOLS: CollecTool[] = ALL_COLLECTOOLS.filter(
  (tool) => tool.id !== "restocks" || RESTOCKS_ENABLED,
)
