import { createLucideIcon } from "lucide-react"

/** SlabCrack — rectangle split in half with interlocking jagged edges. */
export const SlabCrackIcon = createLucideIcon("SlabCrack", [
  ["path", { d: "M5 7h5l-2 2 2 2-2 2 2 2-2 2H5V7", key: "left" }],
  ["path", { d: "M14 7h5v10h-3l2-2-2-2 2-2-2-2 2-2V7", key: "right" }],
])

/** SlabLab — Erlenmeyer flask: tall neck, flared rim, rounded base, liquid + bubbles. */
export const SlabLabIcon = createLucideIcon("SlabLab", [
  ["path", { d: "M8.5 4.2Q12 3.2 15.5 4.2", key: "rim" }],
  ["path", { d: "M10.5 4.2V10", key: "neck-l" }],
  ["path", { d: "M13.5 4.2V10", key: "neck-r" }],
  ["path", { d: "M10.5 10 7.4 18.6", key: "cone-l" }],
  ["path", { d: "M13.5 10 16.6 18.6", key: "cone-r" }],
  ["path", { d: "M7.4 18.6Q12 20.8 16.6 18.6", key: "base" }],
  ["path", { d: "M9.1 13.7H14.9", key: "liquid" }],
  ["circle", { cx: "10.6", cy: "15.1", r: "0.45", key: "b1" }],
  ["circle", { cx: "12.1", cy: "16.4", r: "0.35", key: "b2" }],
  ["circle", { cx: "13.7", cy: "15", r: "0.4", key: "b3" }],
  ["circle", { cx: "11.4", cy: "17.1", r: "0.28", key: "b4" }],
])

/** Two curved arrows — trade / match exchange. */
export const PokeMatchIcon = createLucideIcon("PokeMatch", [
  ["path", { d: "M16 5.5 20 9.5 16 13.5", key: "a1" }],
  ["path", { d: "M20 9.5H10", key: "a1-stem" }],
  ["path", { d: "M8 18.5 4 14.5 8 10.5", key: "a2" }],
  ["path", { d: "M4 14.5H14", key: "a2-stem" }],
])

/**
 * CardLounge — three people (same silhouette style as User / add friend).
 */
export const CardLoungeIcon = createLucideIcon("CardLounge", [
  ["circle", { cx: "6", cy: "8.5", r: "1.75", key: "head-l" }],
  ["path", { d: "M4 17.5v-1a2 2 0 0 1 4 0v1", key: "body-l" }],
  ["circle", { cx: "12", cy: "7.5", r: "2.25", key: "head-c" }],
  ["path", { d: "M8.25 18v-1.5a3.75 3.75 0 0 1 7.5 0V18", key: "body-c" }],
  ["circle", { cx: "18", cy: "8.5", r: "1.75", key: "head-r" }],
  ["path", { d: "M16 17.5v-1a2 2 0 0 1 4 0v1", key: "body-r" }],
])
