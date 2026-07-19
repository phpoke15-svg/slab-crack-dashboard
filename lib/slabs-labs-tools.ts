import type { LucideIcon } from "lucide-react"
import { BarChart3, Layers, Ratio } from "lucide-react"
import {
  SLABCRACK_HREF,
  SLABIT_HREF,
  SLABPOP_HREF,
} from "@/lib/slabs-labs-routes"

export type SlabLabsSubTool = {
  id: "slabcrack" | "slabpop" | "slabit"
  href: string
  name: string
  tagline: string
  blurb: string
  icon: LucideIcon
  comingSoon?: boolean
}

export const SLABLABS_SUBTOOLS: SlabLabsSubTool[] = [
  {
    id: "slabcrack",
    href: SLABCRACK_HREF,
    name: "SlabCrack",
    tagline: "Graded slab arbitrage",
    blurb: "Spot raw vs PSA slab gaps and buy-crack-sell opportunities.",
    icon: Layers,
  },
  {
    id: "slabit",
    href: SLABIT_HREF,
    name: "SlabIt",
    tagline: "Spread · multiplier · ROI",
    blurb: "Rank PSA 10 submission ROI across top modern cards.",
    icon: Ratio,
  },
  {
    id: "slabpop",
    href: SLABPOP_HREF,
    name: "SlabPop",
    tagline: "Pop report filters",
    blurb: "Filter graded cards by PSA population, price band, and grade.",
    icon: BarChart3,
  },
]
