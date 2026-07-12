import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-url"
import { SEO_DEFAULT_DESCRIPTION, SEO_SITE_NAME } from "@/lib/seo"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SEO_SITE_NAME,
    short_name: SEO_SITE_NAME,
    description: SEO_DEFAULT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0b0e14",
    theme_color: "#0b0e14",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
