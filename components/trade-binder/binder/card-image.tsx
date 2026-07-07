"use client"

import Image from "next/image"
import { useCardImage } from "@/hooks/trade-binder/use-card-image"

export function CardImage({
  card,
  alt,
  sizes = "(max-width: 640px) 50vw, 200px",
  className = "object-contain p-1 transition-transform duration-300 group-active:scale-[1.02]",
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
}) {
  const src = useCardImage(card)

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
