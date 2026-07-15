import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Bell,
  BookOpen,
  Layers,
  MessageSquare,
  Package,
  Radar,
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
      "Camera scan in search — AI identifies a card and opens Crack + Lab prices",
    ],
    icon: Layers,
  },
  {
    id: "slablab",
    href: "/slablab",
    name: "SlabLab",
    tagline: "Spread · multiplier · ROI",
    description:
      "Rank the top 200 modern cards by PSA 10 gross spread, graded multiplier, and net ROI after grading cost.",
    highlights: [
      "Live market comps for the top 200 PSA 10 grading opportunities",
      "Model net ROI with current PSA grading tiers",
      "Flag Prime Submission slots and 10-or-Bust danger zones",
      "Camera scan in search — snap a card for Crack + Lab ROI",
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
    id: "card-lounge",
    href: "/card-lounge",
    name: "CardLounge",
    tagline: "Collector social feed",
    description:
      "Twitter-style collector feed — short posts, photos, videos, follows, likes, and replies.",
    highlights: [
      "280-character posts with photo & video uploads",
      "Follow other collectors · Starter through Supreme badges",
      "CardLounge feed + Following timeline",
    ],
    icon: MessageSquare,
  },
  {
    id: "buyout-radar",
    href: "/buyout-radar",
    name: "Buyout Radar",
    tagline: "Supreme · in development",
    description:
      "Detect high-volume buyout clusters and speculation spikes before retail prices move.",
    highlights: [
      "Full catalog market scan (batched) via eBay sold comps",
      "24h volume vs 14-day baseline with spike scoring",
      "Critical / High / Warning priority alerts",
      "Recommended action badges for speculative buys",
    ],
    icon: Radar,
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
