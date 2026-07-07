"use client"

import { CardImage } from "@/components/trade-binder/binder/card-image"

export function SlabCardImage({
  card,
  alt,
  className = "object-contain p-0.5 transition-transform duration-300 group-hover:scale-105",
  sizes = "(max-width: 640px) 64px, 112px",
}: {
  card: {
    id: string
    cardName: string
    setName: string
    imageUrl: string
    cardNumber?: string
  }
  alt: string
  className?: string
  sizes?: string
}) {
  return (
    <CardImage
      card={{
        id: card.id,
        name: card.cardName,
        set: card.setName,
        image: card.imageUrl,
        cardNumber: card.cardNumber,
      }}
      alt={alt}
      sizes={sizes}
      className={className}
    />
  )
}
