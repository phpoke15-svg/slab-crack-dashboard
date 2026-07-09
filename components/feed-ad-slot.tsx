"use client"

import { AdSlot } from "@/components/ad-slot"

type FeedAdSlotProps = {
  slotIndex: number
  className?: string
}

/** SlabCrack in-feed ad — uses the feed slot variant. */
export function FeedAdSlot({ slotIndex, className }: FeedAdSlotProps) {
  return <AdSlot variant="feed" slotIndex={slotIndex} className={className} />
}
