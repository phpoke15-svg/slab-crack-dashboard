export const POKEWATCH_DROP_WINDOW_TZ = "America/New_York"

function etParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: POKEWATCH_DROP_WINDOW_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""

  return {
    weekday: get("weekday"),
    hour: Number(get("hour") === "24" ? "0" : get("hour")),
  }
}

/** Monday–Friday 10:00am–2:59pm America/New_York (inclusive start, exclusive 3pm). */
export function isPokeWatchDropWindow(date = new Date()): boolean {
  const { weekday, hour } = etParts(date)
  const weekdayOk = weekday === "Mon" || weekday === "Tue" || weekday === "Wed" || weekday === "Thu" || weekday === "Fri"
  return weekdayOk && hour >= 10 && hour < 15
}
