"use client"

import Image from "next/image"
import { isMissingCardImage, useCardImage } from "@/hooks/trade-binder/use-card-image"

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
  const src = useCardImage(card, { upgrade })

  if (!upgrade) {
    const directSrc = isMissingCardImage(card.image) ? "/placeholder.svg" : card.image
    return (
      <Image
        src={directSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
    />
  )
}
