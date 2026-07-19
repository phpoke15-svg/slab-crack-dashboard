const VERCEL_ANALYTICS_API = "https://api.vercel.com/v1/query/web-analytics"

export type VercelTrafficPeriod = {
  pageviews: number | null
  visitors: number | null
}

export type VercelTrafficDailyPoint = {
  date: string
  pageviews: number
  visitors: number
}

export type VercelTrafficBreakdownRow = {
  key: string
  pageviews: number
  visitors: number
}

export type VercelTrafficSummary = {
  configured: boolean
  projectId: string | null
  error: string | null
  fetchedAt: string
  monthLabel: string
  monthStart: string
  periods: {
    today: VercelTrafficPeriod
    last7d: VercelTrafficPeriod
    last30d: VercelTrafficPeriod
    monthToDate: VercelTrafficPeriod
  }
  dailyLast30d: VercelTrafficDailyPoint[]
  topRoutes: VercelTrafficBreakdownRow[]
  topReferrers: VercelTrafficBreakdownRow[]
  topCountries: VercelTrafficBreakdownRow[]
}

type VisitsCountResponse = {
  data?: { pageviews?: number; visitors?: number }
  error?: { message?: string }
}

type VisitsAggregateRow = {
  timestamp?: string
  route?: string
  referrerHostname?: string
  country?: string
  pageviews?: number
  visitors?: number
}

type VisitsAggregateResponse = {
  data?: VisitsAggregateRow[]
  error?: { message?: string }
}

function analyticsToken(): string | null {
  return (
    process.env.VERCEL_ANALYTICS_TOKEN?.trim() ||
    process.env.VERCEL_ACCESS_TOKEN?.trim() ||
    process.env.VERCEL_TOKEN?.trim() ||
    null
  )
}

export function isVercelAnalyticsConfigured(): boolean {
  return Boolean(analyticsToken() && projectId())
}

function projectId(): string | null {
  return process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim() || process.env.VERCEL_PROJECT_ID?.trim() || null
}

function teamId(): string | null {
  return (
    process.env.VERCEL_ANALYTICS_TEAM_ID?.trim() ||
    process.env.VERCEL_TEAM_ID?.trim() ||
    process.env.VERCEL_ORG_ID?.trim() ||
    null
  )
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgoUtc(days: number): string {
  const d = startOfUtcDay(new Date())
  d.setUTCDate(d.getUTCDate() - days)
  return toIsoDate(d)
}

function emptyPeriod(): VercelTrafficPeriod {
  return { pageviews: null, visitors: null }
}

function emptySummary(error: string | null): VercelTrafficSummary {
  const now = new Date()
  const monthStart = startOfUtcMonth(now)
  return {
    configured: isVercelAnalyticsConfigured(),
    projectId: projectId(),
    error,
    fetchedAt: now.toISOString(),
    monthLabel: monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    monthStart: toIsoDate(monthStart),
    periods: {
      today: emptyPeriod(),
      last7d: emptyPeriod(),
      last30d: emptyPeriod(),
      monthToDate: emptyPeriod(),
    },
    dailyLast30d: [],
    topRoutes: [],
    topReferrers: [],
    topCountries: [],
  }
}

async function queryVisitsCount(since: string, until: string): Promise<VercelTrafficPeriod> {
  const json = await vercelAnalyticsRequest<VisitsCountResponse>("visits/count", {
    since,
    until,
  })
  return {
    pageviews: json.data?.pageviews ?? null,
    visitors: json.data?.visitors ?? null,
  }
}

async function vercelAnalyticsRequest<T>(
  path: "visits/count" | "visits/aggregate",
  params: Record<string, string>,
): Promise<T> {
  const token = analyticsToken()
  const project = projectId()
  if (!token || !project) {
    throw new Error("Vercel Analytics is not configured")
  }

  const url = new URL(`${VERCEL_ANALYTICS_API}/${path}`)
  url.searchParams.set("projectId", project)
  const team = teamId()
  if (team) url.searchParams.set("teamId", team)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  const json = (await res.json().catch(() => null)) as T & { error?: { message?: string } }
  if (!res.ok) {
    const message = json?.error?.message || `Vercel Analytics request failed (${res.status})`
    throw new Error(message)
  }
  return json
}

export async function getVercelTrafficSummary(): Promise<VercelTrafficSummary> {
  if (!isVercelAnalyticsConfigured()) {
    return emptySummary("Set VERCEL_ANALYTICS_TOKEN (or VERCEL_ACCESS_TOKEN) to enable traffic insights.")
  }

  const now = new Date()
  const today = toIsoDate(startOfUtcDay(now))
  const monthStart = startOfUtcMonth(now)
  const since30d = daysAgoUtc(29)

  try {
    const [todayPeriod, last7d, last30d, monthToDate, daily, topRoutes, topReferrers, topCountries] =
      await Promise.all([
        queryVisitsCount(today, today),
        queryVisitsCount(daysAgoUtc(6), today),
        queryVisitsCount(since30d, today),
        queryVisitsCount(toIsoDate(monthStart), today),
        vercelAnalyticsRequest<VisitsAggregateResponse>("visits/aggregate", {
          since: since30d,
          until: today,
          by: "day",
        }),
        vercelAnalyticsRequest<VisitsAggregateResponse>("visits/aggregate", {
          since: since30d,
          until: today,
          by: "route",
          limit: "8",
        }),
        vercelAnalyticsRequest<VisitsAggregateResponse>("visits/aggregate", {
          since: since30d,
          until: today,
          by: "referrerHostname",
          limit: "6",
        }),
        vercelAnalyticsRequest<VisitsAggregateResponse>("visits/aggregate", {
          since: since30d,
          until: today,
          by: "country",
          limit: "6",
        }),
      ])

    return {
      configured: true,
      projectId: projectId(),
      error: null,
      fetchedAt: now.toISOString(),
      monthLabel: monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      monthStart: toIsoDate(monthStart),
      periods: {
        today: todayPeriod,
        last7d,
        last30d,
        monthToDate,
      },
      dailyLast30d: (daily.data ?? [])
        .filter((row) => row.timestamp)
        .map((row) => ({
          date: row.timestamp!.slice(0, 10),
          pageviews: row.pageviews ?? 0,
          visitors: row.visitors ?? 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topRoutes: (topRoutes.data ?? []).map((row) => ({
        key: row.route || "/",
        pageviews: row.pageviews ?? 0,
        visitors: row.visitors ?? 0,
      })),
      topReferrers: (topReferrers.data ?? [])
        .map((row) => ({
          key: row.referrerHostname?.trim() || "(direct)",
          pageviews: row.pageviews ?? 0,
          visitors: row.visitors ?? 0,
        }))
        .filter((row) => row.key !== "(direct)" || row.pageviews > 0),
      topCountries: (topCountries.data ?? []).map((row) => ({
        key: row.country || "Unknown",
        pageviews: row.pageviews ?? 0,
        visitors: row.visitors ?? 0,
      })),
    }
  } catch (err) {
    return {
      ...emptySummary(err instanceof Error ? err.message : "Could not load Vercel Analytics"),
      configured: true,
      projectId: projectId(),
    }
  }
}

let trafficCache: { at: number; data: VercelTrafficSummary } | null = null
const TRAFFIC_CACHE_MS = 5 * 60 * 1000

/** Cached wrapper — Supreme refresh won't hammer Vercel with 7 parallel API calls. */
export async function getVercelTrafficSummaryCached(): Promise<VercelTrafficSummary> {
  const now = Date.now()
  if (trafficCache && now - trafficCache.at < TRAFFIC_CACHE_MS) {
    return trafficCache.data
  }
  const data = await getVercelTrafficSummary()
  trafficCache = { at: now, data }
  return data
}
