import type { LucideIcon } from "lucide-react"
import { Bell, BookOpen, Layers, Package } from "lucide-react"

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
      "Find PSA slabs selling for less than a raw Near-Mint copy. Free preview shows 10 mid-deficit cards; Premium unlocks the full feed.",
    highlights: [
      "Buy, crack, and sell — spot slabs where cracking and selling raw beats the market price",
      "Buy high-end cards under market for your personal collection",
      "Market awareness — track graded vs raw pricing gaps and stay ahead of the market",
    ],
    icon: Layers,
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
