export type Review = {
  id: string
  /** Id of the user who wrote the review. */
  authorId: string
  /** Whole-number rating from 1 to 5. */
  rating: number
  comment: string
  /** ISO date string. */
  createdAt: string
}

export type User = {
  id: string
  name: string
  handle: string
  avatar: string
  location: string
  bio: string
}

/** The signed-in user (prototype: fixed). */
export const CURRENT_USER_ID = "rook"

export const users: User[] = [
  {
    id: "rook",
    name: "Rook Avery",
    handle: "@rook",
    avatar: "/avatars/rook.png",
    location: "Detroit, MI",
    bio: "Grinding for a full Ashen Peaks set. Fair trades only.",
  },
  {
    id: "mara",
    name: "Mara Voss",
    handle: "@maravoss",
    avatar: "/avatars/mara.png",
    location: "Portland, OR",
    bio: "Foil collector. Ships fast, packs tight.",
  },
  {
    id: "dex",
    name: "Dex Kellan",
    handle: "@dexk",
    avatar: "/avatars/dex.png",
    location: "Austin, TX",
    bio: "Umbral Rites specialist. Always hunting Legendaries.",
  },
  {
    id: "juno",
    name: "Juno Park",
    handle: "@junop",
    avatar: "/avatars/juno.png",
    location: "Seattle, WA",
    bio: "Casual player, serious binder. Let's swap dupes.",
  },
  {
    id: "silas",
    name: "Silas Crane",
    handle: "@silascrane",
    avatar: "/avatars/silas.png",
    location: "Chicago, IL",
    bio: "20 years in the hobby. Vintage sets a specialty.",
  },
  {
    id: "priya",
    name: "Priya Rao",
    handle: "@priyar",
    avatar: "/avatars/priya.png",
    location: "Brooklyn, NY",
    bio: "Wildgrove enthusiast. Trade meetups welcome.",
  },
  {
    id: "tobias",
    name: "Tobias Fenn",
    handle: "@tobiasfenn",
    avatar: "/avatars/tobias.png",
    location: "Denver, CO",
    bio: "New to trading but stocked with Rares.",
  },
]

/** Ids the current user is friends with at the start. */
export const initialFriendIds: string[] = ["mara", "dex"]

/**
 * Ids of traders the current user has completed a trade with.
 * A completed trade — not friendship — is what unlocks leaving a review.
 */
export const initialTradeIds: string[] = ["mara", "juno"]

/** Seed reviews keyed by the user being reviewed. */
export const initialReviews: Record<string, Review[]> = {
  mara: [
    { id: "r1", authorId: "dex", rating: 5, comment: "Cards arrived mint, exactly as described. Would trade again.", createdAt: "2025-11-02" },
    { id: "r2", authorId: "silas", rating: 5, comment: "Smooth communication and lightning-fast shipping.", createdAt: "2025-10-18" },
    { id: "r3", authorId: "juno", rating: 4, comment: "Great trade, packaging could be a touch sturdier.", createdAt: "2025-09-30" },
  ],
  dex: [
    { id: "r4", authorId: "mara", rating: 5, comment: "Knows his Legendaries. Totally fair on values.", createdAt: "2025-11-10" },
    { id: "r5", authorId: "priya", rating: 4, comment: "Solid trade, took a couple days to reply but worth it.", createdAt: "2025-10-05" },
  ],
  juno: [
    { id: "r6", authorId: "silas", rating: 5, comment: "Friendly and honest. Highly recommend swapping dupes.", createdAt: "2025-10-22" },
    { id: "r7", authorId: "tobias", rating: 4, comment: "Good first trade for me, very patient.", createdAt: "2025-09-14" },
  ],
  silas: [
    { id: "r8", authorId: "mara", rating: 5, comment: "A true veteran. Immaculate vintage cards.", createdAt: "2025-11-01" },
    { id: "r9", authorId: "dex", rating: 5, comment: "Best condition grading I've seen. Trustworthy.", createdAt: "2025-10-11" },
    { id: "r10", authorId: "juno", rating: 5, comment: "Generous and knowledgeable. A pleasure.", createdAt: "2025-08-27" },
  ],
  priya: [
    { id: "r11", authorId: "dex", rating: 4, comment: "Great Wildgrove pulls, easy to deal with.", createdAt: "2025-10-19" },
  ],
  tobias: [
    { id: "r12", authorId: "juno", rating: 4, comment: "New but very enthusiastic and fair. Nice Rares.", createdAt: "2025-09-20" },
  ],
  rook: [
    { id: "r13", authorId: "mara", rating: 5, comment: "Fair trader, clear about card conditions. Smooth swap.", createdAt: "2025-11-05" },
    { id: "r14", authorId: "dex", rating: 4, comment: "Good communication, happy with our Ashen Peaks trade.", createdAt: "2025-10-08" },
  ],
}

const usersById = new Map(users.map((u) => [u.id, u]))

export function getUser(id: string): User | undefined {
  return usersById.get(id)
}

/** Average star rating (0 when there are no reviews). */
export function averageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0
  const total = reviews.reduce((sum, r) => sum + r.rating, 0)
  return total / reviews.length
}
