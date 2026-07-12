import type { MetadataRoute } from "next"
import { RESTOCKS_ENABLED } from "@/lib/collectools-tools"
import { LEGAL_SITE_URL } from "@/lib/legal/config"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = LEGAL_SITE_URL.replace(/\/$/, "")
  const lastModified = new Date()

  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/slabcrack`, lastModified, changeFrequency: "daily", priority: 0.95 },
    { url: `${base}/slablab`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/binder`, lastModified, changeFrequency: "daily", priority: 0.85 },
    { url: `${base}/queue-watch`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.75 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
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
