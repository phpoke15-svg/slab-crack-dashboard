import {
  claimPushAlertDedupe,
  sendWebPushToTopic,
} from "@/lib/push/web-push"

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

/** YYYY-MM-DD style key for the ET calendar day containing `date`. */
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
}): Promise<{
  sent: boolean
  reason: string
  weekKey: string
  discordSent: boolean
  pushSent: number
}> {
  const now = new Date()
  const weekKey = etWeekKey(now)

  if (!opts?.force && !isWalmartWednesdayRestockWindow(now)) {
    return { sent: false, reason: "outside_window", weekKey, discordSent: false, pushSent: 0 }
  }

  if (!opts?.force && lastSentWeekKey === weekKey) {
    return { sent: false, reason: "already_sent_this_week", weekKey, discordSent: false, pushSent: 0 }
  }

  const claimed = await claimPushAlertDedupe(`walmart_wed:${weekKey}`, 6 * 24 * 60 * 60 * 1000)
  if (!opts?.force && !claimed) {
    lastSentWeekKey = weekKey
    return { sent: false, reason: "already_sent_this_week", weekKey, discordSent: false, pushSent: 0 }
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

  const pushResult = await sendWebPushToTopic("walmart_wednesday", {
    title: "Walmart Pokémon restock window",
    body: "Weekly sealed drop window — typically Wednesday 9:00 PM ET. Check Restocks.",
    url: `${site}/restocks`,
    tag: "walmart-wednesday",
  })

  let discordSent = false
  const webhook =
    process.env.RESTOCKS_DISCORD_WEBHOOK?.trim() ||
    process.env.POKEMON_CENTER_DISCORD_WEBHOOK?.trim()

  if (webhook) {
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
    discordSent = response.ok
  }

  const pushSent = pushResult.sent
  const sent = pushSent > 0 || discordSent
  if (sent || opts?.force) lastSentWeekKey = weekKey

  if (!sent) {
    return {
      sent: false,
      reason: pushResult.reason || (webhook ? "webhook_failed" : "no_channel"),
      weekKey,
      discordSent,
      pushSent,
    }
  }

  return { sent: true, reason: "ok", weekKey, discordSent, pushSent }
}
