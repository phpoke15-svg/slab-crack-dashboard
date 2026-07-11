import Script from "next/script"
import { getAdSenseClientId, isAdsDisplayEnabled } from "@/lib/adsense-config"

export function AdSenseScript() {
  if (!isAdsDisplayEnabled()) return null

  const clientId = getAdSenseClientId()
  return (
    <Script
      id="adsense-loader"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}
