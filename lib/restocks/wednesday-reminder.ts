const TZ = "America/New_York"

/** Last calendar week (ET) we already pinged — survives within a warm serverless instance. */
let lastSentWeekKey: string | null = null

function etParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
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
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number(get("hour") === "24" ? "0" : get("hour")),
  }
}

/** YYYY-Www style key for the ET calendar week containing `date`. */
export function etWeekKey(date = new Date()): string {
  const { year, month, day } = etParts(date)
  return `${year}-${month}-${day}`
}

/**
 * True during Wednesday 9:00–9:59pm America/New_York.
 * Vercel cron is UTC-only; we schedule both DST offsets and gate here.
 */
export function isWalmartWednesdayRestockWindow(date = new Date()): boolean {
  const { weekday, hour } = etParts(date)
  return weekday === "Wed" && hour === 21
}

export async function sendWalmartWednesdayReminder(opts?: {
  force?: boolean
}): Promise<{ sent: boolean; reason: string; weekKey: string }> {
  const now = new Date()
  const weekKey = etWeekKey(now)

  if (!opts?.force && !isWalmartWednesdayRestockWindow(now)) {
    return { sent: false, reason: "outside_window", weekKey }
  }

  if (!opts?.force && lastSentWeekKey === weekKey) {
    return { sent: false, reason: "already_sent_this_week", weekKey }
  }

  const webhook =
    process.env.RESTOCKS_DISCORD_WEBHOOK?.trim() ||
    process.env.POKEMON_CENTER_DISCORD_WEBHOOK?.trim()
  if (!webhook) {
    return { sent: false, reason: "no_webhook", weekKey }
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "") ||
    "https://slab-crack-dashboard.vercel.app"

  const when = now.toLocaleString("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })

  const payload = {
    content: [
      "@everyone **Walmart Pokémon restock window**",
      "Weekly sealed drop window is typically **Wednesday 9:00 PM ET**.",
      "Watch the board and Affiliate stock checks:",
      `${site}/restocks`,
      `_Reminder · ${when}_`,
    ].join("\n"),
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    return { sent: false, reason: `webhook_${response.status}`, weekKey }
  }

  lastSentWeekKey = weekKey
  return { sent: true, reason: "ok", weekKey }
}
