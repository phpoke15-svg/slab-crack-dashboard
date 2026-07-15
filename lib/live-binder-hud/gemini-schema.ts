/**
 * Gemini structured-output schema for bounding-box detection.
 * Types use Gemini's uppercase enum (OBJECT / ARRAY / STRING / INTEGER).
 *
 * Official box format: [ymin, xmin, ymax, xmax] integers normalized 0–1000.
 */
export const BINDER_HUD_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    cards: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          box_2d: {
            type: "ARRAY",
            description:
              "Bounding box coordinates normalized to 0-1000 in ymin, xmin, ymax, xmax format.",
            items: { type: "INTEGER", format: "int32" },
            minItems: 4,
            maxItems: 4,
          },
          name: { type: "STRING", description: "English Pokemon TCG card name" },
          set: { type: "STRING", description: "Set / expansion name, or empty string" },
          number: { type: "STRING", description: "Collector number like 4/102, or empty string" },
        },
        required: ["box_2d", "name", "set", "number"],
      },
    },
  },
  required: ["cards"],
} as const

/** Alternate: top-level array (matches Google bounding-box cookbook examples). */
export const BINDER_HUD_ARRAY_SCHEMA = {
  type: "ARRAY",
  description: "Detected trading cards with 2D boxes",
  items: {
    type: "OBJECT",
    properties: {
      box_2d: {
        type: "ARRAY",
        description: "Bounding box [ymin, xmin, ymax, xmax] normalized 0-1000",
        items: { type: "INTEGER", format: "int32" },
        minItems: 4,
        maxItems: 4,
      },
      name: { type: "STRING" },
      set: { type: "STRING" },
      number: { type: "STRING" },
    },
    required: ["box_2d", "name"],
  },
} as const

export const BINDER_HUD_SCAN_PROMPT = [
  "Detect every Pokemon trading card visible in this image.",
  "Cards may be alone, in a hand, on a table, or in a binder page — any count.",
  "Return bounding boxes for each card.",
  "box_2d MUST be [ymin, xmin, ymax, xmax] with integer coordinates normalized from 0 to 1000.",
  "Also return name, set, and number for each card (use empty string if unknown).",
  "Tight boxes around each card only. Do not invent prices.",
].join(" ")
