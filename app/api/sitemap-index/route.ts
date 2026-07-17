import { getCardSitemapChunkCount } from "@/lib/db/cards-pseo"
import { LEGAL_SITE_URL } from "@/lib/legal/config"

export const dynamic = "force-dynamic"

function buildSitemapIndexXml(urls: string[]): string {
  const entries = urls
    .map((url) => `  <sitemap><loc>${url}</loc></sitemap>`)
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`
}

export async function GET() {
  const base = LEGAL_SITE_URL.replace(/\/$/, "")
  const cardChunks = await getCardSitemapChunkCount()
  const sitemapCount = 1 + cardChunks
  const urls = Array.from({ length: sitemapCount }, (_, index) => `${base}/sitemap/${index}.xml`)

  return new Response(buildSitemapIndexXml(urls), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  })
}
