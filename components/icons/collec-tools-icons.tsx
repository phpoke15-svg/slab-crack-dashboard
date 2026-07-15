import { createLucideIcon } from "lucide-react"

/**
 * SlabCrack — PSA slab with a jagged crack and a separated chip.
 * Reads as “break the slab” at small sizes.
 */
export const SlabCrackIcon = createLucideIcon("SlabCrack", [
  ["path", { d: "M5 6.5h6.5v11H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 6.5z", key: "slab-l" }],
  ["path", { d: "M11.5 7.5 10 12l1.5 2.5", key: "crack" }],
  ["path", { d: "M12.5 8.5 14 12l-1 2.5", key: "crack-2" }],
  ["path", { d: "M14.5 8h5a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H14", key: "slab-r" }],
  ["path", { d: "M17.5 18.5 19 20.5 17 21.5 15.5 20z", key: "chip" }],
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
 * CardLounge — curved sofa with two collectors and a chat bubble.
 * Signals social hangout + collector feed.
 */
export const CardLoungeIcon = createLucideIcon("CardLounge", [
  ["path", { d: "M4 16h16", key: "seat" }],
  ["path", { d: "M5 16v2H3.5M20.5 18H19", key: "legs" }],
  ["path", { d: "M5 16V12c0-2 2.5-3.5 7-3.5s7 1.5 7 3.5v4", key: "back" }],
  ["path", { d: "M4 14.5c2-1.5 4-2 8-2s6 .5 8 2", key: "cushion" }],
  ["circle", { cx: "8.5", cy: "10", r: "1.35", key: "head-l" }],
  ["circle", { cx: "15.5", cy: "10", r: "1.35", key: "head-r" }],
  ["path", { d: "M7.5 11.5c.8.8 1.7 1.2 2.5 1.2M16.5 11.5c-.8.8-1.7 1.2-2.5 1.2", key: "shoulders" }],
  ["path", { d: "M14.5 4.5h3.5a1 1 0 0 1 1 1v1.5h-4.5V5.5a1 1 0 0 1 1-1z", key: "bubble" }],
  ["path", { d: "M14.5 7 13.5 8.5", key: "bubble-tail" }],
])
