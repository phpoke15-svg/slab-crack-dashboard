import type { MetadataRoute } from "next"
import { ANDROID_PACKAGE, IOS_APP_STORE_ID, iosAppStoreUrl, playStoreUrl } from "@/lib/app-stores"
import { SEO_DEFAULT_DESCRIPTION, SEO_SITE_NAME } from "@/lib/seo"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SEO_SITE_NAME,
    short_name: SEO_SITE_NAME,
    description: SEO_DEFAULT_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en-US",
    dir: "ltr",
    categories: ["finance", "utilities", "productivity"],
    background_color: "#0b0e14",
    theme_color: "#0b0e14",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    related_applications: [
      {
        platform: "itunes",
        url: iosAppStoreUrl(),
        id: IOS_APP_STORE_ID,
      },
      {
        platform: "play",
        url: playStoreUrl(),
        id: ANDROID_PACKAGE,
      },
    ],
    prefer_related_applications: false,
  }
}
