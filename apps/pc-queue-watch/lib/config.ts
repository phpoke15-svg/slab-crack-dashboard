/** Live CollecTools site used by in-app tool WebViews */
export const COLLECTOOLS_BASE_URL =
  process.env.EXPO_PUBLIC_COLLECTOOLS_URL?.replace(/\/$/, "") ||
  "https://slab-crack-dashboard.vercel.app"

export const TOOLS = [
  {
    id: "slabcrack",
    name: "SlabCrack",
    tagline: "Graded slab arbitrage",
    path: "/slabcrack",
  },
  {
    id: "grade-check",
    name: "Grade Check",
    tagline: "Pre-submission estimator",
    path: "/grade-check",
  },
  {
    id: "pokematch",
    name: "PokeMatch",
    tagline: "Collect & trade",
    path: "/binder",
  },
] as const

export const POKEMON_CENTER_URL = "https://www.pokemoncenter.com/"
