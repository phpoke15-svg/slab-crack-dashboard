"use client"

import { Analytics } from "@vercel/analytics/react"
import { useEffect, useState } from "react"
import Script from "next/script"
import { getAdSenseClientId, isAdsDisplayEnabled } from "@/lib/adsense-config"
import { isNativeAppShell } from "@/lib/native-app"

/** Skip third-party analytics/ads inside the native app WebView (App Store 5.1.2). */
export function WebExtras() {
  const [nativeShell, setNativeShell] = useState(false)

  useEffect(() => {
    setNativeShell(isNativeAppShell())
  }, [])

  if (nativeShell) return null

  const clientId = getAdSenseClientId()
  const adsEnabled = isAdsDisplayEnabled()

  return (
    <>
      {adsEnabled ? (
        <Script
          id="adsense-loader"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      ) : null}
      {process.env.NODE_ENV === "production" ? <Analytics /> : null}
    </>
  )
}
