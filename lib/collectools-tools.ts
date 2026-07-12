import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Bell,
  BookOpen,
  Layers,
  Package,
  Ratio,
  ScanSearch,
} from "lucide-react"

/** Flip to true when Walmart Affiliate Restocks ships again for everyone. */
export const RESTOCKS_ENABLED = false

export type CollecTool = {
  id: string
  href: string
  name: string
  tagline: string
  description: string
  highlights?: string[]
  icon: LucideIcon
  /** Only visible to Supreme accounts while still in development. */
  supremeOnly?: boolean
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
      "Scan all set ages for PSA 10 submission edges",
      "Filter by minimum PSA 10 gem rate from pop reports",
      "Flag Prime Submission Slots and 10-or-Bust danger zones",
    ],
    icon: Ratio,
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
    id: "pokewatch",
    href: "/pokewatch",
    name: "PokeWatch",
    tagline: "Pro · Pokemon Center alerts",
    description:
      "Instant browser and phone alerts when the Pokemon Center virtual queue goes live. Included with CollecTools Pro.",
    icon: Bell,
  },
  {
    id: "restocks",
    href: "/restocks",
    name: "Restocks",
    tagline: RESTOCKS_ENABLED ? "Walmart sealed stock" : "Supreme · in development",
    description: RESTOCKS_ENABLED
      ? "Auto-discovers Pokémon TCG sealed products at Walmart and tracks in-stock vs OOS. Pokémon Center drops use PokeWatch."
      : "Walmart sealed auto-discovery. Hidden from public until Affiliate is live — Supreme can preview.",
    icon: Package,
    supremeOnly: !RESTOCKS_ENABLED,
  },
  {
    id: "grade-check",
    href: "/grade-check",
    name: "Grade Check",
    tagline: "Supreme · in development",
    description:
      "Condition / centering helper for submission decisions. Supreme preview while the UX is unfinished.",
    icon: ScanSearch,
    supremeOnly: true,
  },
  {
    id: "supreme",
    href: "/supreme",
    name: "Site Insights",
    tagline: "Owner metrics",
    description:
      "Live product, billing, and ops insights across CollecTools. Supreme accounts only.",
    icon: Activity,
    supremeOnly: true,
  },
]

/** Public hub tools (and Restocks when Affiliate is enabled for everyone). */
export const COLLECTOOLS: CollecTool[] = ALL_COLLECTOOLS.filter((tool) => {
  if (tool.supremeOnly) return false
  if (tool.id === "restocks") return RESTOCKS_ENABLED
  return true
})

/** Tools only Supreme should see on the hub (in-dev + console). */
export const SUPREME_TOOLS: CollecTool[] = ALL_COLLECTOOLS.filter((tool) => tool.supremeOnly)

export function hubToolsForUser(opts: { supreme?: boolean }): CollecTool[] {
  if (!opts.supreme) return COLLECTOOLS
  const publicIds = new Set(COLLECTOOLS.map((t) => t.id))
  return [...COLLECTOOLS, ...SUPREME_TOOLS.filter((t) => !publicIds.has(t.id))]
}
