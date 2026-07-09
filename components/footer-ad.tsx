"use client"

import { AdSlot } from "@/components/ad-slot"

type FooterAdProps = {
  className?: string
}

export function FooterAd({ className }: FooterAdProps) {
  return <AdSlot variant="banner" slotIndex={0} className={className} compact />
}
