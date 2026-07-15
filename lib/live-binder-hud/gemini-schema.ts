/** Official Gemini structured-output schema for binder HUD box_2d detection. */
export const BINDER_HUD_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          box_2d: {
            type: "array",
            items: { type: "integer" },
            description:
              "Bounding box coordinates normalized to 0-1000 in ymin, xmin, ymax, xmax format.",
          },
          name: { type: "string" },
          set: { type: "string" },
          number: { type: "string" },
        },
        required: ["box_2d", "name", "set", "number"],
      },
    },
  },
  required: ["cards"],
} as const

export const BINDER_HUD_SCAN_PROMPT = [
  "Detect every Pokemon / trading card visible in this photo.",
  "Cards may appear alone, in a hand, on a table, or in a binder page (any count).",
  "Use Gemini 2D bounding boxes normalized from 0 to 1000.",
  "box_2d MUST be [ymin, xmin, ymax, xmax] integers on that 0–1000 scale.",
  "Return JSON matching the response schema exactly.",
  "Include every clearly visible trading card.",
  "Prefer English names. If set or number is unknown use an empty string.",
  "Tight boxes around each card only. Do not invent prices.",
].join(" ")
