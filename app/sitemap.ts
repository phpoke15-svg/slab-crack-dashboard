import type { MetadataRoute } from "next"
import { RESTOCKS_ENABLED } from "@/lib/collectools-tools"
import { LEGAL_SITE_URL } from "@/lib/legal/config"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = LEGAL_SITE_URL.replace(/\/$/, "")
  const lastModified = new Date()

  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/slabcrack`, lastModified, changeFrequency: "daily", priority: 0.9 },
    ...(RESTOCKS_ENABLED
      ? [
          {
            url: `${base}/restocks`,
            lastModified,
            changeFrequency: "hourly" as const,
            priority: 0.85,
          },
        ]
      : []),
    { url: `${base}/binder`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/queue-watch`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ]
}
