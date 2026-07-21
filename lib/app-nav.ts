import type { LucideIcon } from "lucide-react"
import {
  Bell,
  FlaskConical,
  Search,
  UserRound,
  Users,
} from "lucide-react"

export type AppNavTabId = "research" | "alerts" | "community" | "labs" | "profile"

export type AppNavTab = {
  id: AppNavTabId
  label: string
  href: string
  icon: LucideIcon
}

export const APP_NAV_TABS: AppNavTab[] = [
  { id: "research", label: "Research", href: "/", icon: Search },
  { id: "alerts", label: "Alerts", href: "/alerts", icon: Bell },
  { id: "community", label: "Community", href: "/community", icon: Users },
  { id: "labs", label: "Labs", href: "/labs", icon: FlaskConical },
  { id: "profile", label: "Profile", href: "/profile", icon: UserRound },
]

const RESEARCH_PREFIXES = ["/tcg-research", "/pokemon/"]
const ALERTS_PREFIXES = ["/alerts", "/pokewatch", "/restocks", "/queue-watch"]
const COMMUNITY_PREFIXES = ["/community", "/binder", "/card-lounge", "/lounge"]
const LABS_PREFIXES = ["/labs", "/slablabs", "/grade-check", "/buyout-radar", "/live-binder-hud", "/psa10-scanner"]
const PROFILE_PREFIXES = ["/profile", "/giveaway", "/feedback", "/supreme", "/pricing"]

const BOTTOM_NAV_HIDDEN_EXACT = new Set([
  "/sign-in",
  "/reset-password",
  "/terms",
  "/privacy",
  "/giveaway-rules",
])

const BOTTOM_NAV_HIDDEN_PREFIXES = [
  "/api/",
  "/pokewatch/mobile",
  "/queue-watch/mobile",
]

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function activeAppNavTab(pathname: string): AppNavTabId {
  if (pathname === "/") return "research"
  if (matchesPrefix(pathname, ALERTS_PREFIXES)) return "alerts"
  if (matchesPrefix(pathname, COMMUNITY_PREFIXES)) return "community"
  if (matchesPrefix(pathname, LABS_PREFIXES)) return "labs"
  if (matchesPrefix(pathname, PROFILE_PREFIXES)) return "profile"
  if (matchesPrefix(pathname, RESEARCH_PREFIXES)) return "research"
  return "research"
}

export function shouldShowBottomNav(pathname: string): boolean {
  if (BOTTOM_NAV_HIDDEN_EXACT.has(pathname)) return false
  if (BOTTOM_NAV_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false
  if (pathname.includes("/scan") || pathname.includes("/multi-scan")) return false
  return true
}
