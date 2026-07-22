import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Bell,
  FlaskConical,
  Gift,
  MessageSquare,
  MessageSquarePlus,
  Package,
  Radar,
  ScanEye,
  ScanSearch,
  Search,
} from "lucide-react"
import { PokeMatchIcon } from "@/components/icons/collec-tools-icons"
import { SLABLABS_HREF } from "@/lib/slabs-labs-routes"

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
    id: "tcg-research",
    href: "/",
    name: "TCG Research",
    tagline: "Search · charts · scan",
    blurb: "Catalog search · charts · scan",
    description:
      "TCG Research is the full-market research hub — hybrid search across Pokémon, Lorcana, and MTG, grade spreads from your local Scrydex cache, price history charts, and camera identify via Scrydex Vision.",
    highlights: [
      "Hybrid local + Scrydex catalog search",
      "Raw and PSA grade spreads from cached prices",
      "Price history charts with one-time Scrydex backfill",
      "Camera Vision scan with $0 local resolution",
    ],
    icon: Search,
  },
  {
    id: "portfolio",
    href: "/portfolio",
    name: "AI Portfolio",
    tagline: "Weekly picks · ROI tracker",
    blurb: "AI weekly picks · ROI",
    description:
      "AI Portfolio Tracker surfaces weekly budget-tiered purchase baskets ($100–$1,000/week) from Scrydex momentum, supply velocity, and PSA spread signals.",
    highlights: [
      "Four budget tiers: $100, $250, $500, and $1,000 per week",
      "Gemini-ranked card baskets with confidence scores and targets",
      "Tier-specific ROI, win rate, and cumulative performance charts",
    ],
    icon: Activity,
  },
  {
    id: "slablabs",
    href: SLABLABS_HREF,
    name: "SlabLabs",
    tagline: "Crack · Pop · Submit",
    blurb: "Crack · Pop · ROI",
    description:
      "SlabLabs groups SlabCrack arbitrage, SlabPop population filters, and SlabIt PSA 10 submission ROI in one graded slab toolkit.",
    highlights: [
      "SlabCrack — top 100 graded arbitrage board",
      "SlabIt — top 100 PSA 10 submission ROI rankings",
      "SlabPop — Scrydex registry population filters",
      "Camera scan on SlabCrack and SlabIt",
    ],
    icon: FlaskConical,
  },
  {
    id: "binder",
    href: "/binder",
    name: "PokeMatch",
    tagline: "Collect & trade",
    blurb: "Binder · trades",
    description:
      "PokeMatch lets you build a digital binder, mark cards for trade or wishlist, and match with other collectors who need what you have.",
    icon: PokeMatchIcon,
  },
  {
    id: "pokewatch",
    href: "/pokewatch",
    name: "PokeWatch",
    tagline: "Pro · Pokemon Center alerts",
    blurb: "PC queue alerts",
    description:
      "PokeWatch sends instant browser and phone alerts when the Pokemon Center virtual queue goes live so you can jump in faster. Included with CollecTools Pro.",
    icon: Bell,
  },
  {
    id: "giveaway",
    href: "/giveaway",
    name: "Monthly Giveaway",
    tagline: "Free entries · cash via PayPal",
    blurb: "Monthly cash prizes",
    description:
      "The CollecTools Monthly Giveaway awards a cash prize (USD) via PayPal each month. Earn one free entry per day by staying active in the app — thresholds vary by plan (30 min Starter, 10 min Premium, 5 min Pro). Mail-in alternate entry available. No purchase necessary.",
    highlights: [
      "Prize value grows with every registered CollecTools account",
      "One app entry per day while signed in and active",
      "Lower daily minute thresholds on Premium and Pro",
      "Cash paid via PayPal only — see official rules",
    ],
    icon: Gift,
  },
  {
    id: "feedback",
    href: "/feedback",
    name: "Feedback",
    tagline: "Ideas · votes · inbox",
    blurb: "Ideas · votes",
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
    blurb: RESTOCKS_ENABLED ? "Walmart stock tracker" : "Walmart · Supreme preview",
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
    blurb: "Pre-submit grading",
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
    blurb: "Social collector feed",
    description:
      "CardLounge is a collector social feed for short posts, photos, videos, follows, likes, and replies — built for Pokémon TCG chatter and show-and-tell.",
    highlights: [
      "280-character posts with photo and video uploads",
      "Follow other collectors with plan badges",
      "Main feed plus a Following timeline",
    ],
    icon: MessageSquare,
  },
  {
    id: "buyout-radar",
    href: "/buyout-radar",
    name: "Buyout Radar",
    tagline: "Supreme · in development",
    blurb: "Buyout spike alerts",
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
    blurb: "Live scan HUD",
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
    blurb: "Owner metrics",
    description:
      "Site Insights shows live product, billing, and ops metrics across CollecTools. Available to Supreme accounts only.",
    icon: Activity,
    supremeOnly: true,
  },
]

/** Labs-only surfaces (not shown on the main hub). */
export const LABS_ONLY_TOOL_IDS = new Set(["portfolio"])

/** Public hub tools (and Restocks when Affiliate is enabled for everyone). */
export const COLLECTOOLS: CollecTool[] = ALL_COLLECTOOLS.filter((tool) => {
  if (tool.supremeOnly) return false
  if (LABS_ONLY_TOOL_IDS.has(tool.id)) return false
  if (tool.id === "restocks") return RESTOCKS_ENABLED
  return true
})

export const LABS_TOOLS: CollecTool[] = ALL_COLLECTOOLS.filter((tool) => LABS_ONLY_TOOL_IDS.has(tool.id))

/** Tools only Supreme should see on the hub (in-dev + console). */
export const SUPREME_TOOLS: CollecTool[] = ALL_COLLECTOOLS.filter((tool) => tool.supremeOnly)

export function hubToolsForUser(opts: { supreme?: boolean }): CollecTool[] {
  if (!opts.supreme) return COLLECTOOLS
  const publicIds = new Set(COLLECTOOLS.map((t) => t.id))
  return [...COLLECTOOLS, ...SUPREME_TOOLS.filter((t) => !publicIds.has(t.id))]
}
