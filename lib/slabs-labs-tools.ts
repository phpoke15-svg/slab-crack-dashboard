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
}

export const SLABLABS_SUBTOOLS: SlabLabsSubTool[] = [
  {
    id: "slabcrack",
    href: SLABCRACK_HREF,
    name: "SlabCrack",
    tagline: "Graded slab arbitrage",
    blurb: "Raw vs PSA gaps",
    icon: Layers,
  },
  {
    id: "slabit",
    href: SLABIT_HREF,
    name: "SlabIt",
    tagline: "Spread · multiplier · ROI",
    blurb: "PSA 10 ROI ranks",
    icon: Ratio,
  },
  {
    id: "slabpop",
    href: SLABPOP_HREF,
    name: "SlabPop",
    tagline: "Pop report filters",
    blurb: "Pop · price filters",
    icon: BarChart3,
  },
]
