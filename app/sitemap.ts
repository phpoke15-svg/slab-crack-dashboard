import type { MetadataRoute } from "next"
import { listCardSitemapRows, getCardSitemapChunkCount } from "@/lib/db/cards-pseo"
import { RESTOCKS_ENABLED } from "@/lib/collectools-tools"
import { LEGAL_SITE_URL } from "@/lib/legal/config"
import { cardPagePath } from "@/lib/seo/card-slugs"

function staticSitemapEntries(): MetadataRoute.Sitemap {
  const base = LEGAL_SITE_URL.replace(/\/$/, "")
  const lastModified = new Date()

  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/alerts`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/community`, lastModified, changeFrequency: "weekly", priority: 0.88 },
    { url: `${base}/labs`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/profile`, lastModified, changeFrequency: "weekly", priority: 0.75 },
    { url: `${base}/slablabs`, lastModified, changeFrequency: "daily", priority: 0.95 },
    { url: `${base}/slablabs/slabcrack`, lastModified, changeFrequency: "daily", priority: 0.93 },
    { url: `${base}/slablabs/slabpop`, lastModified, changeFrequency: "weekly", priority: 0.88 },
    { url: `${base}/slablabs/slabit`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/binder`, lastModified, changeFrequency: "daily", priority: 0.85 },
    { url: `${base}/pokewatch`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/feedback`, lastModified, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.75 },
    { url: `${base}/giveaway`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/giveaway-rules`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ]

  if (RESTOCKS_ENABLED) {
    entries.splice(4, 0, {
      url: `${base}/restocks`,
      lastModified,
      changeFrequency: "hourly",
      priority: 0.85,
    })
  }

  return entries
}

export async function generateSitemaps() {
  const cardChunks = await getCardSitemapChunkCount()
  const maps = [{ id: 0 }]
  for (let i = 0; i < cardChunks; i += 1) {
    maps.push({ id: i + 1 })
  }
  return maps
}

function resolveSitemapId(id: number | string): number {
  const parsed = typeof id === "number" ? id : Number(id)
  return Number.isFinite(parsed) ? parsed : 0
}

export default async function sitemap(props: { id: number | string | Promise<number | string> }): Promise<MetadataRoute.Sitemap> {
  const rawId = typeof props.id === "object" && props.id != null && "then" in props.id ? await props.id : props.id
  const id = resolveSitemapId(rawId)
  const base = LEGAL_SITE_URL.replace(/\/$/, "")

  if (id === 0) {
    return staticSitemapEntries()
  }

  const cardChunkIndex = id - 1
  const rows = await listCardSitemapRows(cardChunkIndex)

  return rows.map((row) => ({
    url: `${base}${cardPagePath(row.setSlug, row.cardSlug)}`,
    lastModified: new Date(row.lastModified),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))
}
