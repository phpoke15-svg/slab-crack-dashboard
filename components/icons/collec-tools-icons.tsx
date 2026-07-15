import { createLucideIcon } from "lucide-react"

/** Graded slab split down the middle. */
export const SlabCrackIcon = createLucideIcon("SlabCrack", [
  ["path", { d: "M5 7v10M5 7h5.5M5 12h5.5M5 17h5.5", key: "left" }],
  ["path", { d: "M10.5 7.5 9 12l1.5 4.5", key: "crack" }],
  ["path", { d: "M13.5 7v10M13.5 7H19M13.5 12H19M13.5 17H19", key: "right" }],
])

/** Lab coat for grading ROI research. */
export const SlabLabIcon = createLucideIcon("SlabLab", [
  ["path", { d: "M9 4.5 12 7.5 15 4.5", key: "collar" }],
  ["path", { d: "M8 7.5h8", key: "shoulders" }],
  ["path", { d: "M7.5 7.5 6 13.5", key: "sleeve-l" }],
  ["path", { d: "M16.5 7.5 18 13.5", key: "sleeve-r" }],
  ["path", { d: "M9.5 7.5v11.5", key: "coat-l" }],
  ["path", { d: "M14.5 7.5v11.5", key: "coat-r" }],
  ["path", { d: "M9.5 19h5", key: "hem" }],
  ["path", { d: "M10.5 12.5h3", key: "pocket" }],
])

/** Two curved arrows — trade / match exchange. */
export const PokeMatchIcon = createLucideIcon("PokeMatch", [
  ["path", { d: "M16 5.5 20 9.5 16 13.5", key: "a1" }],
  ["path", { d: "M20 9.5H10", key: "a1-stem" }],
  ["path", { d: "M8 18.5 4 14.5 8 10.5", key: "a2" }],
  ["path", { d: "M4 14.5H14", key: "a2-stem" }],
])

/** Couch with two collectors. */
export const CardLoungeIcon = createLucideIcon("CardLounge", [
  ["path", { d: "M4 14h16v3H4z", key: "seat" }],
  ["path", { d: "M5 14V11a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3", key: "back" }],
  ["path", { d: "M4 17H2.5M19.5 17H21", key: "legs" }],
  ["circle", { cx: "8.5", cy: "9", r: "1.25", key: "head-l" }],
  ["circle", { cx: "15.5", cy: "9", r: "1.25", key: "head-r" }],
  ["path", { d: "M8.5 10.5v2.5M15.5 10.5v2.5", key: "bodies" }],
])
