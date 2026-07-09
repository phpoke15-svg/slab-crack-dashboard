import type { MetadataRoute } from "next"
import { LEGAL_SITE_URL } from "@/lib/legal/config"

export default function robots(): MetadataRoute.Robots {
  const base = LEGAL_SITE_URL.replace(/\/$/, "")
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/sign-in"],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
