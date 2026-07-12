import type { MetadataRoute } from "next"
import { RESTOCKS_ENABLED } from "@/lib/collectools-tools"
import { LEGAL_SITE_URL } from "@/lib/legal/config"

export default function robots(): MetadataRoute.Robots {
  const base = LEGAL_SITE_URL.replace(/\/$/, "")
  const disallow = [
    "/api/",
    "/sign-in",
    "/supreme",
    "/grade-check",
    "/queue-watch/mobile",
  ]
  if (!RESTOCKS_ENABLED) disallow.push("/restocks")

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
