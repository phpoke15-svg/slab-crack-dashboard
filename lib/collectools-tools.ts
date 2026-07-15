import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Bell,
  MessageSquarePlus,
  Package,
  Radar,
  ScanEye,
  ScanSearch,
} from "lucide-react"
import {
  CardLoungeIcon,
  PokeMatchIcon,
  SlabCrackIcon,
  SlabLabIcon,
} from "@/components/icons/collec-tools-icons"

/** Flip to true when Walmart Affiliate Restocks ships again for everyone. */
export const RESTOCKS_ENABLED = false

export type CollecTool = {
  id: string
  href: string
  name: string
  tagline: string
  /** One short sentence shown on the compact hub row. */
  blurb: string
  /** Longer overview shown after the user opens the tool detail. */
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
    blurb: "Find undervalued graded slabs vs raw market prices.",
    description:
      "SlabCrack compares raw NM prices against PSA slab quotes so you can spot buy-crack-sell opportunities, collection bargains, and graded vs raw gaps. Premium unlocks the full deficit feed; Scan in search opens Crack + Lab pricing from a photo.",
    highlights: [
      "Buy, crack, and sell when cracking a slab beats holding it",
      "Hunt high-end cards priced under market for your collection",
      "Track graded vs raw gaps with live comps",
      "Camera scan in search for instant Crack + Lab prices",
    ],
    icon: SlabCrackIcon,
  },
  {
    id: "slablab",
    href: "/slablab",
    name: "SlabLab",
    tagline: "Spread · multiplier · ROI",
    blurb: "Rank PSA 10 submission ROI across the top modern cards.",
    description:
      "SlabLab ranks the top 200 modern Pokémon TCG cards by PSA 10 gross spread, graded multiplier, and net ROI after grading cost so you can pick stronger submission candidates. Scan in search opens the same Crack + Lab view from a photo.",
    highlights: [
      "Live market comps for top PSA 10 grading opportunities",
      "Model net ROI with current PSA grading tiers",
      "Flag Prime Submission slots and 10-or-Bust danger zones",
      "Camera scan in search for instant Crack + Lab ROI",
    ],
    icon: SlabLabIcon,
  },
  {
    id: "binder",
    href: "/binder",
    name: "PokeMatch",
    tagline: "Collect & trade",
    blurb: "Build your binder and trade with other collectors.",
    description:
      "PokeMatch lets you build a digital binder, mark cards for trade or wishlist, and match with other collectors who need what you have.",
    icon: PokeMatchIcon,
  },
  {
    id: "pokewatch",
    href: "/pokewatch",
    name: "PokeWatch",
    tagline: "Pro · Pokemon Center alerts",
    blurb: "Get alerts when the Pokemon Center queue goes live.",
    description:
      "PokeWatch sends instant browser and phone alerts when the Pokemon Center virtual queue goes live so you can jump in faster. Included with CollecTools Pro.",
    icon: Bell,
  },
  {
    id: "feedback",
    href: "/feedback",
    name: "Feedback",
    tagline: "Ideas · votes · inbox",
    blurb: "Send feedback and vote on tools we should build next.",
    description:
      "Share any product feedback privately with Supreme, then upvote or downvote potential tools so we know what collectors want most.",
    highlights: [
      "Write free-form feedback that only Supreme can read",
      "Vote potential tools up or down with a live scoreboard",
      "Supreme can add new ideas to the voting board",
    ],
    icon: MessageSquarePlus,
  },
  {
    id: "restocks",
    href: "/restocks",
    name: "Restocks",
    tagline: RESTOCKS_ENABLED ? "Walmart sealed stock" : "Supreme · in development",
    blurb: RESTOCKS_ENABLED
      ? "Track Walmart sealed Pokémon TCG stock in one place."
      : "Walmart sealed restock tracker — Supreme preview for now.",
    description: RESTOCKS_ENABLED
      ? "Restocks auto-discovers Pokémon TCG sealed products at Walmart and tracks in-stock vs out-of-stock. Pokémon Center drops still use PokeWatch."
      : "Walmart sealed auto-discovery is in development and hidden from the public until Affiliate is live. Supreme accounts can preview the work in progress.",
    icon: Package,
    supremeOnly: !RESTOCKS_ENABLED,
  },
  {
    id: "grade-check",
    href: "/grade-check",
    name: "Grade Check",
    tagline: "Supreme · in development",
    blurb: "Quick condition and centering help before you submit.",
    description:
      "Grade Check is a condition and centering helper for submission decisions. It is still in development and available as a Supreme preview.",
    icon: ScanSearch,
    supremeOnly: true,
  },
  {
    id: "card-lounge",
    href: "/card-lounge",
    name: "CardLounge",
    tagline: "Collector social feed",
    blurb: "Share posts, photos, and follows with other collectors.",
    description:
      "CardLounge is a collector social feed for short posts, photos, videos, follows, likes, and replies — built for Pokémon TCG chatter and show-and-tell.",
    highlights: [
      "280-character posts with photo and video uploads",
      "Follow other collectors with plan badges",
      "Main feed plus a Following timeline",
    ],
    icon: CardLoungeIcon,
  },
  {
    id: "buyout-radar",
    href: "/buyout-radar",
    name: "Buyout Radar",
    tagline: "Supreme · in development",
    blurb: "Spot buyout spikes before retail prices move.",
    description:
      "Buyout Radar detects high-volume buyout clusters and speculation spikes across the catalog so you can react before retail prices catch up. Supreme preview while the product is still in development.",
    highlights: [
      "Batched catalog scan via eBay sold comps",
      "24h volume vs 14-day baseline with spike scoring",
      "Priority alerts and recommended action badges",
    ],
    icon: Radar,
    supremeOnly: true,
  },
  {
    id: "live-binder-hud",
    href: "/live-binder-hud",
    name: "Live Binder HUD",
    tagline: "Supreme · in development",
    blurb: "Scan Feed sends one frame to Gemini for boxes, names, and prices.",
    description:
      "Live Binder HUD shows a raw camera feed and, on Scan Feed, sends one JPEG still to Gemini for box_2d detection and identity — no local outline tracking. PriceCharting comps fill each overlay. Supreme preview while the product is still in development.",
    highlights: [
      "Raw webcam feed — no OpenCV / local contour tracking",
      "Gemini handles card detection and bounding boxes",
      "Clickable HUD overlays update live with PriceCharting comps",
    ],
    icon: ScanEye,
    supremeOnly: true,
  },
  {
    id: "supreme",
    href: "/supreme",
    name: "Site Insights",
    tagline: "Owner metrics",
    blurb: "Live product, billing, and ops metrics for owners.",
    description:
      "Site Insights shows live product, billing, and ops metrics across CollecTools. Available to Supreme accounts only.",
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
