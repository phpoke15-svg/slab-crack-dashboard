"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { bestDisplayCardImageUrl } from "@/lib/card-image-url"
import { useCardImage } from "@/hooks/trade-binder/use-card-image"

export function CardImage({
  card,
  alt,
  sizes = "(max-width: 640px) 50vw, 200px",
  className = "object-contain p-1 transition-transform duration-300 group-active:scale-[1.02]",
  upgrade = true,
}: {
  card: {
    id: string
    name: string
    set: string
    image: string
    cardNumber?: string
  }
  alt: string
  sizes?: string
  className?: string
  upgrade?: boolean
}) {
  const originalSrc = bestDisplayCardImageUrl(card.image, { upgrade })
  const upgradedSrc = useCardImage(card, { upgrade })
  const preferredSrc = upgrade ? upgradedSrc : originalSrc
  const [useOriginal, setUseOriginal] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setUseOriginal(false)
    setLoaded(false)
  }, [card.id, card.image, preferredSrc])

  const displaySrc = useOriginal ? originalSrc : preferredSrc

  return (
    <div className="relative h-full w-full">
      {!loaded ? (
        <div
          className="absolute inset-0 animate-pulse bg-secondary/80"
          aria-hidden
        />
      ) : null}
      <Image
        src={displaySrc || "/placeholder.svg"}
        alt={alt}
        fill
        sizes={sizes}
        className={cn(
          className,
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!useOriginal && originalSrc !== preferredSrc && originalSrc !== "/placeholder.svg") {
            setUseOriginal(true)
            setLoaded(false)
          } else {
            setLoaded(true)
          }
        }}
      />
    </div>
  )
}
