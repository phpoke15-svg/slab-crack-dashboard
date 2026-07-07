"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
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
  const originalSrc = bestDisplayCardImageUrl(card.image)
  const upgradedSrc = useCardImage(card, { upgrade })
  const preferredSrc = upgrade ? upgradedSrc : originalSrc
  const [useOriginal, setUseOriginal] = useState(false)

  useEffect(() => {
    setUseOriginal(false)
  }, [card.id, card.image, preferredSrc])

  const displaySrc = useOriginal ? originalSrc : preferredSrc

  return (
    <Image
      src={displaySrc || "/placeholder.svg"}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => {
        if (!useOriginal && originalSrc !== preferredSrc && originalSrc !== "/placeholder.svg") {
          setUseOriginal(true)
        }
      }}
    />
  )
}
