"use client"

import { useMemo } from "react"
import { ExternalLink, Smartphone } from "lucide-react"
import {
  cardAndroidIntentUrl,
  cardCustomSchemeUrl,
  cardUniversalLinkUrl,
  detectMobilePlatform,
  storeUrlForPlatform,
} from "@/lib/app-deep-link"
import { iosAppStoreUrl, playStoreUrl } from "@/lib/app-stores"

type CardAppFunnelBannerProps = {
  cardId: string
  setSlug: string
  cardSlug: string
}

export function CardAppFunnelBanner({ cardId, setSlug, cardSlug }: CardAppFunnelBannerProps) {
  const platform = useMemo(
    () => (typeof navigator !== "undefined" ? detectMobilePlatform(navigator.userAgent) : "other"),
    [],
  )

  const universalUrl = cardUniversalLinkUrl(setSlug, cardSlug)
  const storeUrl = storeUrlForPlatform(platform)

  function handleOpenApp(event: React.MouseEvent<HTMLAnchorElement>) {
    if (platform === "other") return

    event.preventDefault()
    const customScheme = cardCustomSchemeUrl(cardId)
    const started = Date.now()

    if (platform === "android") {
      window.location.href = cardAndroidIntentUrl(setSlug, cardSlug)
      return
    }

    window.location.href = customScheme
    window.setTimeout(() => {
      if (Date.now() - started < 2500) {
        window.location.href = storeUrl
      }
    }, 1200)
  }

  return (
    <div className="border-b border-primary/30 bg-primary/10">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Smartphone className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm text-foreground">
            Track this card in your portfolio &amp; enter daily giveaways.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={platform === "other" ? universalUrl : storeUrl}
            onClick={handleOpenApp}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open in App
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
          {platform === "other" ? (
            <span className="flex gap-2 text-xs text-muted-foreground">
              <a href={iosAppStoreUrl()} className="underline hover:text-foreground">
                iOS
              </a>
              <span aria-hidden="true">·</span>
              <a href={playStoreUrl()} className="underline hover:text-foreground">
                Android
              </a>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
